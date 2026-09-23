import Link from "next/link";

import { ScheduleRow } from "@/components/schedule/schedule-row";
import { CHIP_CHECKABLE, FOCUS_WITHIN } from "@/components/ui/controls";
import { SectionHeading } from "@/components/ui/section-heading";
import { WEEKDAY_SHORT } from "@/lib/format";
import type { OngoingTitle } from "@/lib/queries/home";

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
 * Время выхода — из nextEpisodeAt Shikimori, по Москве. Полная неделя — на /schedule.
 */
export function Schedule({ byDay, today }: ScheduleProps) {
  // Неделя с сегодняшнего дня: «сегодня, вт, ср…», а не с понедельника.
  const days = Array.from({ length: 7 }, (_, offset) => ((today - 1 + offset) % 7) + 1);

  return (
    <section aria-labelledby="schedule-title" className="schedule min-w-0">
      <SectionHeading
        id="schedule-title"
        tone="signal"
        className="mb-4"
        aside={
          <Link href="/schedule" className="inline-flex min-h-11 items-center text-muted underline hover:text-text">
            Вся неделя
          </Link>
        }
      >
        Расписание
      </SectionHeading>

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <fieldset className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto border-b border-line px-3 py-3">
          <legend className="sr-only">День недели</legend>
          {days.map((day) => (
            <label
              key={day}
              className={`${CHIP_CHECKABLE} ${FOCUS_WITHIN} shrink-0 cursor-pointer`}
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
                      <ScheduleRow title={title} />
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
