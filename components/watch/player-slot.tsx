import { SourceType } from "@/lib/generated/prisma/enums";
import type { WatchSource } from "@/lib/queries/watch";
import { embedSrc } from "@/lib/watch/embed";

/**
 * Место плеера. Источник — фрейм поставщика (Kodik), поэтому своего плеера здесь нет.
 * Пока источник не подключён, слот держит те же 16:9 и говорит, что происходит: пустой экран
 * на странице просмотра читается как поломка сайта.
 */
export function PlayerSlot({ source, titleName }: { source: WatchSource | null; titleName: string }) {
  // Только фрейм поставщика: прямые файлы (MP4/HLS) в этой версии не воспроизводятся — своего плеера нет.
  const src = source?.type === SourceType.KODIK ? embedSrc(source.url) : null;

  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center border-line bg-surface p-6 text-center sm:rounded-lg sm:border">
        <p className="max-w-[40ch] text-muted">
          Источник для этой серии ещё не подключён. Мы добавляем озвучки по мере их появления.
        </p>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden bg-surface sm:rounded-lg">
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
