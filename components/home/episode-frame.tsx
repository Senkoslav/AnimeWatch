import Image from "next/image";
import type { ReactNode } from "react";

import { PosterBackdrop } from "@/components/ui/poster-backdrop";

interface EpisodeFrameProps {
  thumbUrl: string | null;
  posterUrl: string | null;
  /** Подсказка ширины кадра. */
  sizes: string;
  /** Подсказка ширины постера-замены: он занимает треть кадра по ширине. */
  posterSizes: string;
  /** Первый экран: картинка может оказаться LCP и грузится сразу. */
  eager?: boolean;
  /** Слой поверх кадра: номер серии, метка «вышло», кнопка воспроизведения. */
  children?: ReactNode;
  className?: string;
}

/**
 * Кадр серии 16:9 (Main.dc.html, Home-mobile.dc.html).
 *
 * Кадров у импорта с Shikimori нет, а выдумывать их нельзя. Поэтому без кадра — честная замена:
 * резкий постер у левого края, за ним он же размытый на всю ширину. Постер 2:3 в кадре 16:9
 * занимает ровно треть — справа остаётся место под номер серии.
 */
export function EpisodeFrame({
  thumbUrl,
  posterUrl,
  sizes,
  posterSizes,
  eager = false,
  children,
  className = "",
}: EpisodeFrameProps) {
  return (
    <div className={`relative aspect-video overflow-hidden border border-line bg-surface ${className}`}>
      {thumbUrl ? (
        <Image
          src={thumbUrl}
          alt=""
          fill
          sizes={sizes}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          className="object-cover"
        />
      ) : (
        <>
          <PosterBackdrop src={posterUrl} className="inset-0" />
          {posterUrl && (
            <div className="absolute inset-y-0 left-0 aspect-2/3">
              <Image
                src={posterUrl}
                alt=""
                fill
                sizes={posterSizes}
                loading={eager ? "eager" : "lazy"}
                fetchPriority={eager ? "high" : "auto"}
                className="object-cover"
              />
            </div>
          )}
        </>
      )}
      {children}
    </div>
  );
}
