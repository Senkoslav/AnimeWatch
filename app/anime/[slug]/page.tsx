import { Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ListControl } from "@/components/bookmarks/list-control";
import { RatingControl } from "@/components/bookmarks/rating-control";
import { EpisodeList } from "@/components/title/episode-list";
import { ExpandableText } from "@/components/title/expandable-text";
import { button, CHIP, TAG, TAG_SIGNAL } from "@/components/ui/controls";
import { Poster } from "@/components/ui/poster";
import { PosterBackdrop } from "@/components/ui/poster-backdrop";
import { EpisodeGrid } from "@/components/watch/episode-grid";
import { catalogHref } from "@/lib/catalog/params";
import { formatAgeRating, formatAirDay, formatCount, formatScore, formatSeason } from "@/lib/format";
import { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/labels";
import { getTitlePage, type TitlePage } from "@/lib/queries/title";
import { episodeHref, titleHref } from "@/lib/routes";
import { OPEN_GRAPH_BASE } from "@/lib/site/metadata";

// docs/02, «Кеширование»: ISR раз в 5 минут. Кешируется и 404: опубликованный черновик или снятая жалоба до 5 минут
// отдают «нет страницы», скрытый тайтл до 5 минут виден. Тегов у страницы нет, мгновенно её сбросит только
// revalidatePath(`/anime/${slug}`) из админки (задача «кеш-теги» в docs/06).
export const revalidate = 300;

/** Пустой список: страницы собираются по первому запросу и кешируются, база на сборке не нужна. */
export function generateStaticParams(): { slug: string }[] {
  return [];
}

/** Описание длиннее этого почти всегда занимает больше трёх строк: показываем «Читать дальше». */
const COLLAPSIBLE_DESCRIPTION = 220;
const META_DESCRIPTION = 160;

/** Постер один и тот же на телефоне и на десктопе: подсказка ширины под обе колонки. */
const POSTER_SIZES = "(min-width: 1024px) 296px, (min-width: 768px) 272px, 136px";

export async function generateMetadata({ params }: PageProps<"/anime/[slug]">): Promise<Metadata> {
  const title = await getTitlePage((await params).slug);
  if (!title) return {};

  const full = title.description ?? `${title.nameRu} — смотреть онлайн на AnimeWatch`;
  const description = full.length > META_DESCRIPTION ? `${full.slice(0, META_DESCRIPTION - 1)}…` : full;
  return {
    title: title.nameRu,
    description,
    // Относительный путь от metadataBase: чужой хост сюда не попадёт по построению.
    alternates: { canonical: titleHref(title.slug) },
    openGraph: {
      ...OPEN_GRAPH_BASE,
      type: title.kind === TitleKind.MOVIE ? "video.movie" : "video.tv_show",
      title: title.nameRu,
      description,
      // Постер с Shikimori уже абсолютный; ссылка в мессенджере приходит с картинкой.
      images: title.posterUrl ? [title.posterUrl] : undefined,
    },
  };
}

/**
 * Страница тайтла по Title.dc.html. Отзывов с макета здесь нет: у них своя задача, и без аккаунтов
 * на их месте были бы выдуманные люди.
 *
 * Раскладка одна на обе ширины. На десктопе — две колонки: слева постер, действия и факты, справа
 * заголовок, оценка, описание и серии. На телефоне обёртки колонок становятся `contents`, и те же
 * блоки встают в один поток в своём порядке: постер рядом с заголовком, дальше действия, оценка,
 * описание, серии, факты. Разметка не дублируется — скринридер слышит каждый блок один раз.
 */
export default async function TitlePageView({ params }: PageProps<"/anime/[slug]">) {
  const title = await getTitlePage((await params).slug);
  if (!title) notFound();

  // Момент рендера: при ISR метка «новая» стареет до 5 минут. Осознанно.
  const now = new Date();
  const isMovie = title.kind === TitleKind.MOVIE;
  const status = title.status === TitleStatus.HIDDEN ? null : title.status;
  const [firstEpisode] = title.episodes;
  // «Смотреть» ведёт туда, где играет: первая серия с источником, а если не подключено ничего — первая вообще.
  const startEpisode = title.episodes.find((episode) => episode.hasSource) ?? firstEpisode;
  const [mainGenre] = title.genres;

  return (
    <div className="relative">
      <PosterBackdrop src={title.posterUrl} fade className="inset-x-0 top-0 h-80" />

      <div className="relative mx-auto max-w-page px-4 lg:px-8 pt-4 pb-6 md:pb-10">
        <nav aria-label="Вы здесь" className="text-sm text-muted">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link href="/" className="inline-flex min-h-11 items-center hover:text-text">
                Главная
              </Link>
            </li>
            <Crumb>
              <Link href="/catalog" className="inline-flex min-h-11 items-center hover:text-text">
                Каталог
              </Link>
            </Crumb>
            {mainGenre && (
              <Crumb>
                <Link
                  href={catalogHref({ genres: [mainGenre] })}
                  className="inline-flex min-h-11 items-center hover:text-text"
                >
                  {mainGenre}
                </Link>
              </Crumb>
            )}
          </ol>
        </nav>

        <div className="mt-2 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-5 md:mt-14 md:grid-cols-[17rem_minmax(0,1fr)] md:gap-x-8 lg:grid-cols-[18.5rem_minmax(0,1fr)]">
          {/* Левая колонка на десктопе; на телефоне её блоки встают в общий поток. */}
          <div className="contents md:flex md:flex-col md:gap-3.5">
            <div className="col-start-1 row-start-1">
              <Poster src={title.posterUrl} title={title.nameRu} sizes={POSTER_SIZES} loading="preload" radius="lg" />
            </div>

            <div className="order-2 col-span-2 flex flex-col gap-2.5 md:order-none">
              {startEpisode && (
                <Link href={episodeHref(title.slug, startEpisode.number)} className={`${button()} w-full`}>
                  <Play aria-hidden="true" className="size-4 fill-current" />
                  {isMovie ? "Смотреть" : `Смотреть эпизод ${startEpisode.number}`}
                </Link>
              )}
              <ListControl titleId={title.id} className="w-full" />
            </div>

            <dl className="order-6 col-span-2 overflow-hidden rounded-lg border border-line bg-surface md:order-none">
              {facts(title).map(([name, value]) => (
                <div
                  key={name}
                  className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-3.5 py-2 last:border-b-0"
                >
                  <dt className="text-sm text-dim">{name}</dt>
                  {/* Пустое место рисуется прочерком, а не пропадает строкой (docs/04, «Компоненты»). */}
                  <dd className={`text-right text-sm font-medium ${value ? "" : "cell-ghost"}`}>
                    {value ?? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">нет данных</span>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Правая колонка на десктопе. */}
          <div className="contents md:flex md:min-w-0 md:flex-col md:gap-6 md:pt-2">
            <div className="contents lg:flex lg:items-start lg:gap-8">
              <header className="col-start-2 row-start-1 flex min-w-0 flex-col gap-2.5 self-center md:self-auto lg:flex-1">
                <h1 className="font-display text-xl leading-tight font-bold tracking-tight text-balance break-words hyphens-auto md:text-3xl">
                  {title.nameRu}
                </h1>
                {title.name !== title.nameRu && <p className="text-sm text-muted md:text-md">{title.name}</p>}
                <ul aria-label="Коротко" className="mt-1 flex flex-wrap gap-2">
                  {title.year && <li className={TAG}>{title.year}</li>}
                  <li className={TAG}>{KIND_LABELS[title.kind]}</li>
                  {!isMovie && title.totalEpisodes && (
                    <li className={TAG}>{formatCount(title.totalEpisodes, ["серия", "серии", "серий"])}</li>
                  )}
                  {status && (
                    // Янтарь только у «выходит»: это и есть то, что происходит сейчас.
                    <li className={status === TitleStatus.ONGOING ? TAG_SIGNAL : TAG}>
                      {status === TitleStatus.ONGOING && (
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />
                      )}
                      {STATUS_LABELS[status].toLocaleLowerCase("ru")}
                    </li>
                  )}
                </ul>
              </header>

              {title.score !== null && (
                <div className="order-3 col-span-2 rounded-lg border border-line bg-surface p-4 md:order-none lg:w-53 lg:shrink-0">
                  <p className="text-xs text-dim">Оценка Shikimori</p>
                  {/* Оценка янтарная по закону мира; полоса — «заполненная часть», тот же сигнал. */}
                  <p
                    className="mt-1.5 font-display text-2xl leading-none font-bold tracking-tight text-signal"
                    data-numeric=""
                  >
                    {formatScore(title.score)}
                  </p>
                  <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-fill-2">
                    <div className="h-full bg-signal" style={{ width: `${Math.min(100, title.score * 10)}%` }} />
                  </div>
                  <p className="mt-2.5 text-xs text-dim">
                    Средней по оценкам зрителей сайта пока нет: их ещё мало.
                  </p>
                </div>
              )}
            </div>

            {/* Своя оценка — сразу под оценкой Shikimori: две оценки рядом читаются как пара. */}
            <div className="order-3 col-span-2 md:order-none">
              <RatingControl titleId={title.id} />
            </div>

            <div className="order-4 col-span-2 flex flex-col gap-4 md:order-none">
              {title.genres.length > 0 && (
                <ul aria-label="Жанры" className="flex flex-wrap gap-2">
                  {title.genres.map((genre) => (
                    <li key={genre}>
                      <Link href={catalogHref({ genres: [genre] })} className={`${CHIP} max-w-full break-words`}>
                        {genre}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {title.description && (
                <ExpandableText
                  text={title.description}
                  collapsible={title.description.length > COLLAPSIBLE_DESCRIPTION}
                />
              )}
            </div>

            <div className="order-5 col-span-2 md:order-none">
              {/* Список — когда у серий есть названия или кадры: тогда строка что-то говорит о серии.
                  Иначе (обычный случай после импорта с Shikimori) — плитки с номером. */}
              {isMovie || title.episodes.some((episode) => episode.name || episode.thumbUrl) ? (
                <EpisodeList title={title} now={now} thumbs footer={episodesFooter(title)} />
              ) : (
                <EpisodeGrid title={title} now={now} footer={episodesFooter(title)} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Звено крошек со своей косой чертой: разделитель — оформление, скринридеру его читать незачем. */
function Crumb({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className="text-dim">
        /
      </span>
      {children}
    </li>
  );
}

/** Таблица фактов под постером. Год и тип стоят метками у заголовка, здесь — то, чего там нет. */
function facts(title: TitlePage): [string, string | null][] {
  const status = title.status === TitleStatus.HIDDEN ? null : title.status;
  const rows: [string, string | null][] = [
    ["Сезон", formatSeason(title.season)],
    ["Возраст", formatAgeRating(title.ageRating)],
  ];
  if (title.kind !== TitleKind.MOVIE) {
    rows.push([
      "Серий",
      title.totalEpisodes && title.totalEpisodes > title.episodes.length
        ? `${title.episodes.length} из ${title.totalEpisodes}`
        : String(title.episodes.length),
    ]);
  }
  // День выхода имеет смысл только у того, что ещё выходит.
  if (status === TitleStatus.ONGOING) rows.push(["Выходит", formatAirDay(title.airDay)]);
  return rows;
}

/** Подвал списка серий: что показано, когда выйдет остальное, и вход с первой серии. */
function episodesFooter(title: TitlePage) {
  const [first] = title.episodes;
  if (!first || title.kind === TitleKind.MOVIE) return undefined;

  const total = title.episodes.length;
  const airDay = title.status === TitleStatus.ONGOING ? formatAirDay(title.airDay) : null;
  const rest = title.totalEpisodes && title.totalEpisodes > total ? title.totalEpisodes - total : 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Сколько серий, уже сказано в заголовке блока: здесь — только то, чего там нет. */}
      {rest > 0 && airDay ? (
        <p className="text-xs text-dim">Остальные {rest} выйдут по расписанию, {airDay}.</p>
      ) : (
        <span />
      )}
      <Link href={episodeHref(title.slug, first.number)} className={button("secondary", "sm")}>
        Начать с первой
      </Link>
    </div>
  );
}
