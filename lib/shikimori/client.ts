/**
 * Клиент GraphQL Shikimori. Всё общение с ними идёт через него: здесь живут лимиты частоты,
 * повторы и таймаут. Зависимости (fetch, сон, часы) внедряются, поэтому клиент проверяется
 * тестами без сети и без настоящего ожидания.
 */
import { animeNodeSchema, animesResponseSchema, type AnimeNode } from "./schema";

/** Старый shikimori.one отвечает 308 на этот адрес (проверено 2026-09-18). */
const ENDPOINT = "https://shikimori.io/api/graphql";

/** Они требуют опознаваемый User-Agent; без него запросы отклоняются. */
const USER_AGENT = "AnimeWatch/1.0 (+https://github.com/Senkoslav/AnimeWatch)";

/** Их лимиты — 5 rps и 90 rpm. Держимся ниже: повтор после блокировки дороже пары лишних миллисекунд. */
const MAX_PER_SECOND = 4;
const MAX_PER_MINUTE = 80;

const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1_000;

/** Больше 50 за запрос они не отдают. */
export const MAX_PAGE_SIZE = 50;

const ANIMES_QUERY = `query Animes($limit: PositiveInt, $page: PositiveInt, $order: OrderEnum, $ids: String, $kind: AnimeKindString, $status: AnimeStatusString) {
  animes(limit: $limit, page: $page, order: $order, ids: $ids, kind: $kind, status: $status) {
    id name russian english japanese synonyms kind status season
    airedOn { year }
    episodes episodesAired duration rating description score
    genres { russian }
    poster { originalUrl }
  }
}`;

export interface AnimesQuery {
  limit?: number;
  page?: number;
  order?: "popularity" | "ranked" | "aired_on";
  /** Список id через запятую — так их API принимает выборку по конкретным тайтлам. */
  ids?: number[];
  kind?: string;
  status?: string;
}

export interface ClientOptions {
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Куда писать о повторах: в CLI это консоль, в тестах — накопитель. */
  onRetry?: (message: string) => void;
}

export interface ShikimoriClient {
  animes(query: AnimesQuery): Promise<AnimeNode[]>;
}

class RateLimiter {
  private readonly hits: number[] = [];

  constructor(
    private readonly now: () => number,
    private readonly sleep: (ms: number) => Promise<void>,
  ) {}

  /** Ждёт ровно столько, чтобы не выйти ни за секундный, ни за минутный лимит. */
  async take(): Promise<void> {
    for (;;) {
      const now = this.now();
      while (this.hits.length > 0 && now - (this.hits[0] ?? 0) >= 60_000) this.hits.shift();

      const inSecond = this.hits.filter((hit) => now - hit < 1_000).length;
      if (inSecond < MAX_PER_SECOND && this.hits.length < MAX_PER_MINUTE) {
        this.hits.push(now);
        return;
      }

      const waitSecond = inSecond >= MAX_PER_SECOND ? 1_000 - (now - (this.hits.at(-MAX_PER_SECOND) ?? now)) : 0;
      const waitMinute = this.hits.length >= MAX_PER_MINUTE ? 60_000 - (now - (this.hits[0] ?? now)) : 0;
      await this.sleep(Math.max(waitSecond, waitMinute, 10));
    }
  }
}

function retryDelay(response: Response, attempt: number): number {
  // Retry-After у них в секундах; если его нет — растущая пауза.
  const header = Number(response.headers.get("retry-after"));
  return Number.isFinite(header) && header > 0 ? header * 1_000 : RETRY_BASE_MS * 2 ** (attempt - 1);
}

export function createShikimoriClient(options: ClientOptions = {}): ShikimoriClient {
  const doFetch = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const limiter = new RateLimiter(now, sleep);

  async function request(variables: Record<string, unknown>): Promise<unknown> {
    for (let attempt = 1; ; attempt += 1) {
      await limiter.take();

      const response = await doFetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": USER_AGENT },
        body: JSON.stringify({ query: ANIMES_QUERY, variables }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.ok) return response.json();

      // 429 и пятисотки — временные: ждём и повторяем. Остальное (400, 404) повтором не лечится.
      const retriable = response.status === 429 || response.status >= 500;
      if (!retriable || attempt >= MAX_ATTEMPTS) {
        throw new Error(`Shikimori ответил ${response.status} ${response.statusText}`);
      }
      const delay = retryDelay(response, attempt);
      options.onRetry?.(`Shikimori ответил ${response.status}, повтор через ${Math.round(delay / 1000)} с`);
      await sleep(delay);
    }
  }

  return {
    async animes(query: AnimesQuery): Promise<AnimeNode[]> {
      const body = await request({
        limit: Math.min(query.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
        page: query.page,
        order: query.order,
        ids: query.ids?.join(","),
        kind: query.kind,
        status: query.status,
      });

      const parsed = animesResponseSchema.parse(body);
      if (parsed.errors?.length) {
        throw new Error(`Shikimori вернул ошибку: ${parsed.errors.map((error) => error.message).join("; ")}`);
      }

      // Отдельный тайтл со сломанным полем не должен ронять весь импорт: пропускаем его и идём дальше.
      return (parsed.data?.animes ?? []).flatMap((node) => {
        const anime = animeNodeSchema.safeParse(node);
        return anime.success ? [anime.data] : [];
      });
    },
  };
}
