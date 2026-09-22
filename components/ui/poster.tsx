import Image from "next/image";
import type { ReactNode } from "react";

interface PosterProps {
  src: string | null;
  /** Название — подпись вместо постера, если картинки нет. */
  title: string;
  sizes: string;
  /** preload — картинка героя; eager — видна без прокрутки и может оказаться LCP (на телефоне карточка крупнее героя). */
  loading?: "preload" | "eager" | "lazy";
  /** Фон под заглушкой: он обязан отличаться от того, на чём лежит карточка, иначе тайтл без постера пропадает. */
  background?: "surface" | "bg";
  /** Слой поверх постера: значок оценки. Контейнер здесь позиционированный, поэтому место есть. */
  children?: ReactNode;
  /** md — постер в карточке, lg — большой постер страницы тайтла (docs/04, «Токены»: радиусы). */
  radius?: "md" | "lg";
  className?: string;
}

const BACKGROUNDS = { surface: "bg-surface", bg: "bg-bg" } as const;
const RADII = { md: "rounded-md", lg: "rounded-lg" } as const;

/** Постер 2:3. Пропорция задана контейнером, поэтому вёрстка не прыгает ни с картинкой, ни без неё. */
export function Poster({
  src,
  title,
  sizes,
  loading = "lazy",
  background = "surface",
  children,
  radius = "md",
  className = "",
}: PosterProps) {
  return (
    <div
      className={`relative aspect-2/3 overflow-hidden border border-line ${RADII[radius]} ${BACKGROUNDS[background]} ${className}`}
    >
      {src ? (
        // alt пустой: название всегда стоит текстом рядом, иначе скринридер прочтёт его дважды.
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          preload={loading === "preload"}
          loading={loading === "lazy" ? "lazy" : "eager"}
          fetchPriority={loading === "lazy" ? "auto" : "high"}
          className="object-cover"
        />
      ) : (
        <p className="absolute inset-0 flex items-end p-3 text-sm font-medium text-muted" aria-hidden="true">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}
