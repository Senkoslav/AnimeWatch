import Link from "next/link";

import { Poster } from "@/components/ui/poster";
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
    <Link href={titleHref(title.slug)} className="block rounded-md">
      <Poster
        src={title.posterUrl}
        title={title.nameRu}
        sizes={sizes}
        background={background}
        loading={eager ? "eager" : "lazy"}
      />
      <p className="mt-2 line-clamp-2 text-sm font-medium">{title.nameRu}</p>
      {/* Отдельный блок, а не строка внутри того же <p>: скринридер читает «Твоё имя, 2016, Фильм» по частям. */}
      <p className="mt-1 text-xs text-muted">{details}</p>
    </Link>
  );
}
