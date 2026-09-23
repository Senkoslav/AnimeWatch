import type { Metadata } from "next";

import { ScheduleRow } from "@/components/schedule/schedule-row";
import { CHIP, CHIP_ACTIVE, PAGE_TITLE } from "@/components/ui/controls";
import { SectionHeading } from "@/components/ui/section-heading";
import { moscowWeekday, WEEKDAY_FULL, WEEKDAY_SHORT } from "@/lib/format";
import { getSchedule } from "@/lib/queries/home";

export const metadata: Metadata = {
  title: "Расписание",
  description: "Когда выходят новые серии онгоингов: дни недели и время по Москве.",
  alternates: { canonical: "/schedule" },
};

// Данные меняет только импорт, а «сегодня» сдвигается раз в сутки: пять минут кеша достаточно.
export const revalidate = 300;

/**
 * Расписание на неделю (docs/06, фаза C). Неделя начинается с сегодняшнего дня, а не с понедельника:
 * сюда приходят узнать, что выйдет сегодня и завтра.
 *
 * Время — из nextEpisodeAt Shikimori на момент импорта, показано днём недели и временем по Москве:
 * дата устарела бы через неделю, а день и время у сериала повторяются.
 */
export default async function SchedulePage() {
  // Момент рендера: при ISR «сегодня» стареет до пяти минут после полуночи. Осознанно.
  const today = moscowWeekday(new Date());
  const byDay = await getSchedule();
  const days = Array.from({ length: 7 }, (_, offset) => ((today - 1 + offset) % 7) + 1);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <h1 className={PAGE_TITLE}>Расписание</h1>
      <p className="mt-2 max-w-[62ch] text-sm text-dim">
        Время выхода серии в Японии, по Москве, по данным Shikimori. Озвучка обычно появляется позже.
      </p>

      {/* Якоря, а не вкладки: вся неделя стоит на странице, ряд только сокращает дорогу к дню. */}
      <nav aria-label="Дни недели" className="mt-5 flex flex-wrap gap-2">
        {days.map((day) => (
          <a key={day} href={`#day-${day}`} className={day === today ? CHIP_ACTIVE : CHIP}>
            {day === today ? "сегодня" : WEEKDAY_SHORT[day - 1]}
          </a>
        ))}
      </nav>

      <div className="mt-8 flex flex-col gap-9">
        {days.map((day) => {
          const titles = byDay.get(day) ?? [];
          const isToday = day === today;
          return (
            <section key={day} id={`day-${day}`} aria-labelledby={`day-${day}-title`} className="scroll-mt-sticky">
              {/* Засечка янтарная только у сегодняшнего дня: это и есть «сейчас». */}
              <SectionHeading
                id={`day-${day}-title`}
                tone={isToday ? "signal" : "neutral"}
                className="mb-3"
                aside={titles.length > 0 ? String(titles.length) : undefined}
              >
                {isToday ? `Сегодня, ${WEEKDAY_FULL[day - 1]?.toLocaleLowerCase("ru")}` : WEEKDAY_FULL[day - 1]}
              </SectionHeading>
              {titles.length === 0 ? (
                // Пустой день говорит об этом словами (приёмка роадмапа), а не оставляет пустую рамку.
                <p className="rounded-lg border border-dashed border-line px-4 py-5 text-base text-muted">
                  В этот день ничего не выходит.
                </p>
              ) : (
                <ul className="overflow-hidden rounded-lg border border-line bg-surface">
                  {titles.map((title) => (
                    <li key={title.slug} className="border-b border-line last:border-b-0">
                      <ScheduleRow title={title} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
