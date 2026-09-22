import Image from "next/image";

interface PosterBackdropProps {
  src: string | null;
  /**
   * Растворить низ в странице. Маской, а не градиентной заливкой поверх: заливка — это ещё один
   * цвет на странице, а маска просто убирает картинку там, где она кончается (docs/04 отбрасывает
   * градиент в герое как признак категории).
   */
  fade?: boolean;
  className?: string;
}

/**
 * Размытый постер фоном (Title.dc.html, Watch.dc.html, Main.dc.html): цвет на страницу приносит
 * сам тайтл, а не наша краска. Картинка берётся самой маленькой — под размытием в 52px разницы
 * между 96px и 1000px не видно, а байты видно.
 *
 * Сверху — сплошная тёмная основа: текст поверх обязан читаться на любом постере. Без постера
 * остаётся одна основа, и блок не превращается в дыру.
 */
export function PosterBackdrop({ src, fade = false, className = "" }: PosterBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute overflow-hidden ${fade ? "[mask-image:linear-gradient(to_bottom,black_40%,transparent)]" : ""} ${className}`}
    >
      {src && <Image src={src} alt="" fill sizes="96px" className="scale-125 object-cover blur-[52px] saturate-150" />}
      <div className="absolute inset-0 bg-bg/70" />
    </div>
  );
}
