import Link from "next/link";

import { Poster } from "@/components/ui/poster";
import { ScoreBadge } from "@/components/ui/score-badge";
import { TitleStatus } from "@/lib/generated/prisma/enums";
import { KIND_LABELS, STATUS_LABELS } from "@/lib/labels";
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
  const facts = [title.year, KIND_LABELS[title.kind]].filter(Boolean).join(", ");
  // HIDDEN сюда не доходит: такой тайтл отсекается ещё в запросе (publicTitleWhere).
  const status = title.status === TitleStatus.HIDDEN ? null : title.status;
  const ongoing = status === TitleStatus.ONGOING;

  return (
    <Link href={titleHref(title.slug)} className="group block rounded-md">
      <Poster
        src={title.posterUrl}
        title={title.nameRu}
        sizes={sizes}
        background={background}
        loading={eager ? "eager" : "lazy"}
      >
        {title.score !== null && <ScoreBadge score={title.score} />}
      </Poster>

      {/* Две строки всегда, даже под коротким названием: иначе подписи соседних карточек встают на
          разной высоте и линейки ряда перестают собираться — а на них держится весь мир. */}
      <p className="mt-2.5 line-clamp-2 min-h-[2.6rem] text-sm leading-snug font-medium group-hover:underline">
        {title.nameRu}
      </p>

      {/*
       * Линованная подпись: слева выходные данные, справа состояние. Ячейка стоит всегда — у тайтла
       * без года она пустая по форме, а не отсутствует. Янтарь только у «выходит»: это и есть то,
       * что происходит сейчас; у завершённого и анонса состояние приглушённое.
       */}
      <p className="mt-2 flex items-baseline justify-between gap-2 border-t border-line pt-2 text-xs">
        {facts ? (
          <span className="min-w-0 truncate text-dim">{facts}</span>
        ) : (
          <span className="cell-ghost shrink-0" aria-hidden="true">
            —
          </span>
        )}
        {status && (
          <span className={`shrink-0 ${ongoing ? "font-medium text-signal" : "text-dim"}`}>
            {STATUS_LABELS[status].toLocaleLowerCase("ru")}
          </span>
        )}
      </p>
    </Link>
  );
}
