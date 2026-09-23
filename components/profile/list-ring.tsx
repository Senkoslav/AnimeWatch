"use client";

import { useState } from "react";

import { LIST_FILL, LIST_STROKE, share } from "@/components/profile/chart-colors";
import { formatCount } from "@/lib/format";
import type { WatchState } from "@/lib/generated/prisma/enums";
import { WATCH_STATE_LABELS } from "@/lib/labels";

const RADIUS = 70;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Зазор между секторами — поверхность, а не обводка (docs/04: 2px). */
const GAP = 2;

const TITLES = ["тайтл", "тайтла", "тайтлов"] as const;

interface ListRingProps {
  lists: { state: WatchState; count: number }[];
  total: number;
}

/**
 * «Списки»: кольцо части от целого и таблица рядом (docs/04, «Диаграммы»). Цвет не единственный
 * носитель смысла — числа и доли стоят в таблице, а подпись кольца называет их все.
 *
 * Клиентский островок только ради наведения: сектор или строка таблицы под курсором выводит свой
 * список в центр кольца вместо общего числа. Всё, что показывает наведение, есть и в таблице.
 */
export function ListRing({ lists, total }: ListRingProps) {
  const [active, setActive] = useState<WatchState | null>(null);

  const present = lists.filter((list) => list.count > 0);
  const largest = present.reduce<(typeof present)[number] | null>(
    (top, list) => (top && top.count >= list.count ? top : list),
    null,
  );
  const shown = lists.find((list) => list.state === active) ?? null;

  // Каждый сектор начинается там, где кончился предыдущий: накопленная длина — без мутаций в рендере.
  const segments = present.reduce<{ state: WatchState; count: number; dash: string; offset: number; end: number }[]>(
    (acc, list) => {
      const start = acc.at(-1)?.end ?? 0;
      const length = (list.count / total) * CIRCUMFERENCE;
      // Один непустой список — целое кольцо без зазора: разрыв там ничего не разделял бы.
      const drawn = present.length === 1 ? length : Math.max(length - GAP, 0.5);
      return [...acc, { ...list, dash: `${drawn} ${CIRCUMFERENCE - drawn}`, offset: -start, end: start + length }];
    },
    [],
  );

  const label = `Распределение списков: ${lists
    .map((list) => `${WATCH_STATE_LABELS[list.state].toLocaleLowerCase("ru")} ${list.count}`)
    .join(", ")}`;

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
      <div className="flex shrink-0 flex-col items-center gap-3">
        <div className="relative size-48">
          <svg viewBox="0 0 200 200" role="img" aria-label={label} className="size-full -rotate-90">
            <circle cx="100" cy="100" r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-fill" />
            {segments.map((segment) => (
              <circle
                key={segment.state}
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={segment.dash}
                strokeDashoffset={segment.offset}
                onPointerEnter={() => setActive(segment.state)}
                onPointerLeave={() => setActive(null)}
                className={`${LIST_STROKE[segment.state]} transition-opacity ${active && active !== segment.state ? "opacity-40" : ""}`}
              />
            ))}
          </svg>
          {/* Центр: общее число, а под курсором — выбранный список. Числа — дисплейной гарнитурой. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl leading-none font-bold tracking-tight" data-numeric="">
              {shown ? shown.count : total}
            </span>
            <span className="mt-1.5 text-xs text-dim">
              {shown ? WATCH_STATE_LABELS[shown.state].toLocaleLowerCase("ru") : "в списках"}
            </span>
          </div>
        </div>
        {largest && (
          <p className="text-center text-sm">
            <span className="font-medium">{WATCH_STATE_LABELS[largest.state]}</span>{" "}
            <span className="text-dim">
              {formatCount(largest.count, TITLES)}, {share(largest.count, total)}
            </span>
          </p>
        )}
      </div>

      <table className="w-full min-w-0 text-sm">
        <caption className="mb-2 text-left text-xs text-dim">Отметки, которые вы поставили</caption>
        <tbody>
          {lists.map((list) => (
            <tr
              key={list.state}
              onPointerEnter={() => setActive(list.state)}
              onPointerLeave={() => setActive(null)}
              className={`border-b border-line last:border-b-0 ${active === list.state ? "bg-surface-2" : ""}`}
            >
              <td className="w-6 py-2.5 pl-1">
                <span aria-hidden="true" className={`block size-2.5 rounded-[3px] ${LIST_FILL[list.state]}`} />
              </td>
              <th scope="row" className="py-2.5 text-left font-medium">
                {WATCH_STATE_LABELS[list.state]}
              </th>
              <td className="py-2.5 text-right font-display font-semibold tabular-nums">{list.count}</td>
              <td className="w-16 py-2.5 pr-1 text-right text-dim tabular-nums">{share(list.count, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
