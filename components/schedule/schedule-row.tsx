import Image from "next/image";
import Link from "next/link";

import { formatAirTime } from "@/lib/format";
import type { OngoingTitle } from "@/lib/queries/home";
import { titleHref } from "@/lib/routes";

/**
 * Строка расписания — одна на главную и на /schedule (Main.dc.html): время по Москве, мини-постер,
 * название и номер следующей серии. Время стоит в фиксированном поле слева, как номер в списке
 * серий: при прокрутке недели времена собираются в сплошную линейку.
 */
export function ScheduleRow({ title }: { title: OngoingTitle }) {
  const next = nextEpisode(title);
  const time = title.nextEpisodeAt ? formatAirTime(title.nextEpisodeAt) : null;

  return (
    <Link
      href={titleHref(title.slug)}
      aria-label={[title.nameRu, time && `в ${time}`, next].filter(Boolean).join(", ")}
      className="flex min-h-15 items-center gap-3.5 px-4 py-2 hover:bg-surface-2"
    >
      {/* Нет времени — прочерк в той же ячейке: пустое место рисуется, а не пропадает (docs/04). */}
      <span className={`w-11 shrink-0 text-sm font-semibold tabular-nums ${time ? "text-text-2" : "cell-ghost"}`}>
        {time ?? "—:—"}
      </span>
      <span className="relative h-11.5 w-8 shrink-0 overflow-hidden rounded-sm border border-line bg-surface-2">
        {title.posterUrl && <Image src={title.posterUrl} alt="" fill sizes="32px" className="object-cover" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-base">{title.nameRu}</span>
      {next && <span className="shrink-0 text-sm text-dim">{next}</span>}
    </Link>
  );
}

/** «эпизод 8»: следующая после вышедших, если она вообще будет. */
function nextEpisode(title: OngoingTitle): string | null {
  const next = title.published + 1;
  if (title.totalEpisodes && next > title.totalEpisodes) return null;
  return `эпизод ${next}`;
}
