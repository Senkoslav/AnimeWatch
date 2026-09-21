import Link from "next/link";

import { Poster } from "@/components/ui/poster";
import { formatScore } from "@/lib/format";
import { KIND_LABELS } from "@/lib/labels";
import type { CatalogItem } from "@/lib/queries/catalog";
import { titleHref } from "@/lib/routes";

/** Сетка поиска: две колонки на телефоне, шесть на широком экране. У каталога она уже, он передаёт своё. */
const POSTER_SIZES = "(min-width: 1280px) 180px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

interface TitleCardProps {
  title: CatalogItem;
  /** Первый ряд на телефоне виден без прокрутки. */
  eager?: boolean;
  /** Подсказка ширины постера: зависит от сетки страницы, а не от карточки. */
  sizes?: string;
  /** На чём лежит карточка: внутри панели --surface заглушке постера нужен другой фон. */
  background?: "surface" | "bg";
}

/** Карточка каталога: ведёт на страницу тайтла. */
export function TitleCard({ title, eager = false, sizes = POSTER_SIZES, background = "surface" }: TitleCardProps) {
  const details = [title.year, KIND_LABELS[title.kind]].filter(Boolean).join(", ");

  return (
    <Link href={titleHref(title.slug)} className="group relative block rounded-md">
      <Poster
        src={title.posterUrl}
        title={title.nameRu}
        sizes={sizes}
        background={background}
        loading={eager ? "eager" : "lazy"}
      />

      {/* Две строки всегда, даже под коротким названием: иначе подписи соседних карточек встают на
          разной высоте и линейки ряда перестают собираться — а на них держится весь мир. */}
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm leading-snug font-medium group-hover:underline">
        {title.nameRu}
      </p>

      {/*
       * Линованная подпись: слева выходные данные, справа оценка в своей ячейке. Ячейка стоит
       * всегда — у тайтла без оценки она пустая по форме, а не отсутствует. Молча пропасть может
       * только то, чего не бывает; «оценки пока нет» — это состояние, и его рисуют.
       */}
      <p className="mt-1 flex items-baseline justify-between gap-2 border-t border-line pt-1 text-xs text-muted">
        <span className="min-w-0 truncate">{details}</span>
        {title.score === null ? (
          <span className="cell-ghost shrink-0 tabular-nums" aria-hidden="true">
            —
          </span>
        ) : (
          <span className="shrink-0 font-medium text-ink-bright tabular-nums">
            <span className="sr-only">Оценка Shikimori </span>
            {formatScore(title.score)}
          </span>
        )}
      </p>
    </Link>
  );
}
