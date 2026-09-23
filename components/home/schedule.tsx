import Image from "next/image";
import Link from "next/link";

import { CHIP, FOCUS_WITHIN } from "@/components/ui/controls";
import { SectionHeading } from "@/components/ui/section-heading";
import { WEEKDAY_SHORT } from "@/lib/format";
import type { OngoingTitle } from "@/lib/queries/home";
import { titleHref } from "@/lib/routes";

/** Строк на день: расписание на главной — выжимка, а не весь список недели. */
const ROWS_PER_DAY = 5;

interface ScheduleProps {
  byDay: Map<number, OngoingTitle[]>;
  /** Сегодняшний день по Москве, 1 — понедельник: с него начинается ряд и он выбран. */
  today: number;
}

/**
 * «Расписание» (Main.dc.html). Дни — радиокнопки-чипы: выбор переключает панель одним CSS
 * (`.schedule:has(...)` в globals.css), без JS и без параметра в адресе — главная остаётся ISR.
 *
 * Времени выхода на макете нет смысла рисовать: Shikimori отдаёт его отдельным полем, которого мы не
 * храним. Строка говорит, какая серия следующая. «Вся неделя» появится вместе с /schedule.
 */
export function Schedule({ byDay, today }: ScheduleProps) {
  // Неделя с сегодняшнего дня: «сегодня, вт, ср…», а не с понедельника.
  const days = Array.from({ length: 7 }, (_, offset) => ((today - 1 + offset) % 7) + 1);

  return (
    <section aria-labelledby="schedule-title" className="schedule min-w-0">
      <SectionHeading id="schedule-title" tone="signal" className="mb-4">
        Расписание
      </SectionHeading>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <fieldset className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto border-b border-line px-3 py-3">
          <legend className="sr-only">День недели</legend>
          {days.map((day) => (
            <label
              key={day}
              className={`${CHIP} ${FOCUS_WITHIN} shrink-0 cursor-pointer has-[:checked]:border-signal-line has-[:checked]:bg-signal-soft has-[:checked]:text-signal`}
            >
              <input
                type="radio"
                name="schedule-day"
                id={`schedule-day-${day}`}
                value={day}
                defaultChecked={day === today}
                className="sr-only outline-none"
              />
              {day === today ? "сегодня" : WEEKDAY_SHORT[day - 1]}
            </label>
          ))}
        </fieldset>

        {days.map((day) => {
          const titles = byDay.get(day) ?? [];
          const rest = titles.length - ROWS_PER_DAY;
          return (
            <div key={day} data-day={day} className="schedule-panel">
              {titles.length === 0 ? (
                // Пустой день говорит об этом словами, а не оставляет пустую рамку.
                <p className="px-4 py-6 text-base text-muted">В этот день ничего не выходит.</p>
              ) : (
                <ul>
                  {titles.slice(0, ROWS_PER_DAY).map((title) => (
                    <li key={title.slug} className="border-b border-line last:border-b-0">
                      <Link
                        href={titleHref(title.slug)}
                        className="flex min-h-15 items-center gap-3.5 px-4 py-2 hover:bg-surface-2"
                      >
                        <span className="relative h-11.5 w-8 shrink-0 overflow-hidden rounded-sm border border-line bg-surface-2">
                          {title.posterUrl && (
                            <Image src={title.posterUrl} alt="" fill sizes="32px" className="object-cover" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-base">{title.nameRu}</span>
                        <span className="shrink-0 text-sm text-dim">{nextEpisode(title)}</span>
                      </Link>
                    </li>
                  ))}
                  {rest > 0 && <li className="px-4 py-2.5 text-xs text-dim">и ещё {rest} в этот день</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** «эпизод 8»: следующая после вышедших, если она вообще будет. */
function nextEpisode(title: OngoingTitle): string | null {
  const next = title.published + 1;
  if (title.totalEpisodes && next > title.totalEpisodes) return null;
  return `эпизод ${next}`;
}
