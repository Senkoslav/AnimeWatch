/**
 * Лимит частоты запросов на Redis (`REDIS_URL`, интеграция Vercel ↔ Redis). Фиксированное окно:
 * счётчик `INCR` на ключ «область + хеш адреса + номер окна», срок жизни — окно. Точнее скользящего
 * окна не нужно: лимит отсекает перебор, а не считает деньги.
 *
 * Отказ Redis не роняет сайт: нет адреса, нет соединения, запрос не уложился в таймаут — лимит
 * пропускает запрос (fail-open) и пишет в лог. Поиск без лимита хуже, чем с ним, но лучше, чем
 * поиск, который не работает из-за склада счётчиков.
 */
import "server-only";

import { createClient } from "redis";

import { hashIp } from "@/lib/client-ip";

/** Минимум, который лимитеру нужен от клиента Redis: так он проверяется подделкой без сервера. */
export interface CounterStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface LimitRule {
  /** Сколько запросов разрешено за окно. */
  limit: number;
  windowSeconds: number;
}

/** Ответ Redis дольше этого — лимит пропускает запрос: поиск не должен ждать склад счётчиков. */
const COMMAND_TIMEOUT_MS = 400;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Redis не ответил за ${ms} мс`)), ms)),
  ]);
}

/**
 * Считает попадание и говорит, превышен ли лимит. Ключ живёт ровно одно окно: первое попадание
 * ставит срок, последующие его не продлевают.
 */
export async function countHit(
  store: CounterStore,
  scope: string,
  id: string,
  { limit, windowSeconds }: LimitRule,
  now: number = Date.now(),
): Promise<{ limited: boolean; count: number }> {
  const bucket = Math.floor(now / 1000 / windowSeconds);
  const key = `rl:${scope}:${id}:${bucket}`;
  const count = await withTimeout(store.incr(key), COMMAND_TIMEOUT_MS);
  if (count === 1) await withTimeout(store.expire(key, windowSeconds), COMMAND_TIMEOUT_MS);
  return { limited: count > limit, count };
}

// Одно соединение на инстанс функции: Vercel переиспользует инстансы, и соединение живёт между
// вызовами. Упало — следующий вызов попробует заново.
let connecting: Promise<CounterStore | null> | null = null;

function store(): Promise<CounterStore | null> {
  const url = process.env.REDIS_URL;
  if (!url) return Promise.resolve(null);
  connecting ??= (async () => {
    const client = createClient({
      url,
      socket: { connectTimeout: 2000, reconnectStrategy: (retries) => (retries > 3 ? false : 200) },
    });
    client.on("error", (error: Error) => console.error("[rate-limit] Redis:", error.message));
    await client.connect();
    return client;
  })().catch((error: unknown) => {
    console.error("[rate-limit] нет соединения с Redis, лимит пропускает запросы:", error instanceof Error ? error.message : error);
    connecting = null;
    return null;
  });
  return connecting;
}

/**
 * Лимит на адрес посетителя. Адрес хешируется с солью: в Redis лежит только хеш, и тот — одно окно.
 */
export async function hitRateLimit(scope: string, ip: string, rule: LimitRule): Promise<{ limited: boolean }> {
  const redis = await store();
  if (!redis) return { limited: false };
  try {
    const { limited } = await countHit(redis, scope, hashIp(ip), rule);
    return { limited };
  } catch (error) {
    console.error(`[rate-limit] ${scope}: счётчик недоступен, запрос пропущен:`, error instanceof Error ? error.message : error);
    return { limited: false };
  }
}
