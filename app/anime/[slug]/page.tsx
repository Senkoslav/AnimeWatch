import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EpisodeList } from "@/components/title/episode-list";
import { ExpandableText } from "@/components/title/expandable-text";
import { Poster } from "@/components/ui/poster";
import { catalogHref } from "@/lib/catalog/params";
import { formatCount } from "@/lib/format";
import { TitleKind, TitleStatus } from "@/lib/generated/prisma/enums";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/labels";
import { getTitlePage, type TitlePage } from "@/lib/queries/title";
import { episodeHref } from "@/lib/routes";

// docs/02, «Кеширование»: ISR раз в 5 минут. Кешируется и 404: опубликованный черновик или снятая жалоба до 5 минут
// отдают «нет страницы», скрытый тайтл до 5 минут виден. Тегов у страницы нет, мгновенно её сбросит только
// revalidatePath(`/anime/${slug}`) из админки (задача «кеш-теги» в docs/06).
export const revalidate = 300;

/** Пустой список: страницы собираются по первому запросу и кешируются, база на сборке не нужна. */
export function generateStaticParams(): { slug: string }[] {
  return [];
}

/** Описание длиннее этого почти всегда занимает больше трёх строк: показываем «Ещё». */
const COLLAPSIBLE_DESCRIPTION = 220;
const META_DESCRIPTION = 160;

export async function generateMetadata({ params }: PageProps<"/anime/[slug]">): Promise<Metadata> {
  const title = await getTitlePage((await params).slug);
  if (!title) return {};

  const description = title.description ?? `${title.nameRu} — смотреть онлайн на AnimeWatch`;
  return {
    title: title.nameRu,
    description: description.length > META_DESCRIPTION ? `${description.slice(0, META_DESCRIPTION - 1)}…` : description,
  };
}

export default async function TitlePageView({ params }: PageProps<"/anime/[slug]">) {
  const title = await getTitlePage((await params).slug);
  if (!title) notFound();

  // Момент рендера: при ISR метка «новая» стареет до 5 минут. Осознанно.
  const now = new Date();
  const [firstEpisode] = title.episodes;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      {/* На телефоне постер уходит в шапку рядом с названием, на десктопе — липкая колонка слева. */}
      <div className="grid grid-cols-2 items-start gap-x-4 gap-y-8 md:grid-cols-[240px_minmax(0,1fr)] md:gap-x-10">
        <header className="col-start-2 row-start-1 min-w-0 space-y-3">
          <h1 className="text-lg leading-tight font-semibold text-balance break-words md:text-2xl">{title.nameRu}</h1>
          {title.name !== title.nameRu && <p className="text-sm text-muted">{title.name}</p>}
          <p className="text-sm">{facts(title)}</p>
          {title.genres.length > 0 && (
            <ul aria-label="Жанры" className="flex flex-wrap gap-2">
              {title.genres.map((genre) => (
                <li key={genre}>
                  <Link
                    href={catalogHref({ genre })}
                    className="inline-flex min-h-11 max-w-full items-center rounded-sm border border-line px-3 text-sm break-words hover:bg-surface-2"
                  >
                    {genre}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </header>

        <aside className="col-start-1 row-start-1 space-y-4 md:sticky md:top-6 md:row-span-2">
          <Poster src={title.posterUrl} title={title.nameRu} sizes="(min-width: 768px) 240px, 50vw" loading="preload" />
          {firstEpisode && (
            <Link
              href={episodeHref(title.slug, firstEpisode.number)}
              className="flex min-h-11 items-center justify-center rounded-sm bg-text px-5 font-medium text-bg hover:bg-muted"
            >
              Смотреть
            </Link>
          )}
        </aside>

        <div className="col-span-2 min-w-0 space-y-10 md:col-span-1 md:col-start-2">
          {title.description && (
            <ExpandableText text={title.description} collapsible={title.description.length > COLLAPSIBLE_DESCRIPTION} />
          )}
          <EpisodeList title={title} now={now} />
        </div>
      </div>
    </div>
  );
}

/** «2023, ТВ-сериал, 28 серий, выходит» — через запятую, по смыслу от общего к частному. */
function facts(title: TitlePage): string {
  const parts: (string | null)[] = [
    title.year ? String(title.year) : null,
    KIND_LABELS[title.kind],
    title.kind !== TitleKind.MOVIE && title.totalEpisodes
      ? formatCount(title.totalEpisodes, ["серия", "серии", "серий"])
      : null,
    // HIDDEN сюда не доходит: такой тайтл не найден ещё в запросе.
    title.status === TitleStatus.HIDDEN ? null : STATUS_LABELS[title.status].toLocaleLowerCase("ru"),
  ];
  return parts.filter(Boolean).join(", ");
}
