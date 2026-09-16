import Image from "next/image";

interface PosterProps {
  src: string | null;
  /** Название — подпись вместо постера, если картинки нет. */
  title: string;
  sizes: string;
  /** preload — картинка героя; eager — видна без прокрутки и может оказаться LCP (на телефоне карточка крупнее героя). */
  loading?: "preload" | "eager" | "lazy";
  className?: string;
}

/** Постер 2:3. Пропорция задана контейнером, поэтому вёрстка не прыгает ни с картинкой, ни без неё. */
export function Poster({ src, title, sizes, loading = "lazy", className = "" }: PosterProps) {
  return (
    <div className={`relative aspect-2/3 overflow-hidden rounded-md border border-line bg-surface ${className}`}>
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
    </div>
  );
}
