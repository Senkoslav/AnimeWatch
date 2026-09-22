import Link from "next/link";

import { button } from "@/components/ui/controls";
import { PosterBackdrop } from "@/components/ui/poster-backdrop";
import { SourceType } from "@/lib/generated/prisma/enums";
import type { WatchSource } from "@/lib/queries/watch";
import type { EpisodeRoute, titleHref } from "@/lib/routes";
import { embedSrc } from "@/lib/watch/embed";

interface PlayerSlotProps {
  source: WatchSource | null;
  titleName: string;
  posterUrl: string | null;
  titleHref: ReturnType<typeof titleHref>;
  /** Ближайшая серия, у которой источник есть: туда ведёт главная кнопка пустого состояния. */
  nextPlayable: { number: number; href: EpisodeRoute } | null;
  /** Сколько вышедших серий подключено — для строки «Из 7 вышедших серий подключены 4». */
  connected: number;
  published: number;
}

/**
 * Место плеера. Источник — фрейм поставщика (Kodik), поэтому своего плеера здесь нет.
 *
 * Без источника слот не сжимается в серую плашку, а занимает всё место плеера и говорит, что
 * происходит и что делать (Watch.dc.html): пустой экран на странице просмотра читается как поломка
 * сайта, а именно его увидит проверяющий из Kodik до того, как выдан токен.
 */
export function PlayerSlot({
  source,
  titleName,
  posterUrl,
  titleHref,
  nextPlayable,
  connected,
  published,
}: PlayerSlotProps) {
  // Только фрейм поставщика: прямые файлы (MP4/HLS) в этой версии не воспроизводятся — своего плеера нет.
  const src = source?.type === SourceType.KODIK ? embedSrc(source.url) : null;

  if (src) {
    return (
      <div className="aspect-video w-full overflow-hidden border-line bg-surface sm:rounded-lg sm:border">
        <iframe
          src={src}
          title={`${titleName} — плеер`}
          // Плеер поставщика сам уходит в полный экран и стартует воспроизведение по кнопке.
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          loading="lazy"
          className="size-full border-0"
        />
      </div>
    );
  }

  return (
    // На телефоне 16:9 слишком низок для текста и двух кнопок: высота там по содержимому.
    <section
      aria-labelledby="player-state"
      className="relative flex min-h-88 w-full flex-col overflow-hidden border-line md:aspect-video md:min-h-0 sm:rounded-lg sm:border"
    >
      <PosterBackdrop src={posterUrl} className="inset-0" />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-5 pt-8 pb-16 text-center sm:px-10">
        {/* Сигнал: доступ к источнику подключается прямо сейчас — это и есть «сейчас». */}
        <span className="inline-flex size-16 items-center justify-center rounded-lg border border-signal-line bg-signal-soft text-signal sm:size-19">
          <SignalIcon />
        </span>
        <h2
          id="player-state"
          className="max-w-[24ch] font-display text-lg leading-tight font-semibold tracking-tight sm:text-2xl"
        >
          Источник для этой серии ещё не подключён
        </h2>
        <p className="max-w-[56ch] text-base text-text-2 sm:text-md">
          Озвучки приходят от стороннего поставщика. Как только эта серия появится у него, она заработает здесь сама —
          возвращаться и что-то нажимать не нужно.
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          {nextPlayable && (
            <Link href={nextPlayable.href} className={button()}>
              <PlayIcon />
              Смотреть эпизод {nextPlayable.number}
            </Link>
          )}
          <Link href={titleHref} className={button("secondary")}>
            К странице тайтла
          </Link>
        </div>
        {connected > 0 && (
          <p className="text-sm text-dim">
            Из {published} вышедших серий подключены {connected}
          </p>
        )}
      </div>

      {/* Строка статуса — стекло первого уровня: под ней размытый постер, её есть что размывать. */}
      <p className="glass-chrome absolute inset-x-0 bottom-0 flex min-h-11 items-center gap-2.5 border-t border-line px-4 text-sm text-text-2 sm:px-5">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-signal" />
        Плеер поставщика, доступ подключается
      </p>
    </section>
  );
}

function SignalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-8" fill="none" stroke="currentColor">
      <path d="M5.5 8.5a9 9 0 0 1 13 0" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 11.5a5 5 0 0 1 8 0" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
      <path d="M7 4.5l13 7.5-13 7.5z" />
    </svg>
  );
}
