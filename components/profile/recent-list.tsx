import Image from "next/image";
import Link from "next/link";

import { LIST_FILL } from "@/components/profile/chart-colors";
import { formatRelativeDate } from "@/lib/format";
import { WATCH_STATE_LABELS } from "@/lib/labels";
import type { ProfileRecent } from "@/lib/queries/profile";
import { titleHref } from "@/lib/routes";

/**
 * «Последнее» (Profile.dc.html): линованные строки — постер, название и когда отмечено, список с
 * точкой цвета диаграммы и своя оценка. Строки «серия 7 из 28» с макета нет: прогресса просмотра
 * плеер поставщика нам не сообщает, а выдуманный прогресс хуже честного «отмечено вчера».
 */
export function RecentList({ items, now }: { items: ProfileRecent[]; now: Date }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-line bg-surface">
      {items.map((item) => (
        <li key={item.slug} className="border-b border-line last:border-b-0">
          <Link
            href={titleHref(item.slug)}
            className="flex min-h-18 items-center gap-3.5 px-4 py-2.5 hover:bg-surface-2"
          >
            <span className="relative h-15 w-10 shrink-0 overflow-hidden rounded-sm border border-line bg-surface-2">
              {item.posterUrl && <Image src={item.posterUrl} alt="" fill sizes="40px" className="object-cover" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-base font-medium">{item.nameRu}</span>
              <span className="text-xs text-dim">
                {/* На телефоне колонки списка нет — он уходит в подпись, а не пропадает. */}
                <span className="sm:hidden">{WATCH_STATE_LABELS[item.state]}, </span>
                отмечено {formatRelativeDate(item.updatedAt, now)}
              </span>
            </span>
            <span className="hidden shrink-0 items-center gap-1.5 text-xs text-text-2 sm:inline-flex">
              <span aria-hidden="true" className={`size-2 rounded-full ${LIST_FILL[item.state]}`} />
              {WATCH_STATE_LABELS[item.state].toLocaleLowerCase("ru")}
            </span>
            <span className="w-7 shrink-0 text-right font-display text-base font-semibold text-signal tabular-nums">
              {item.rating ?? <span className="text-dim">—</span>}
              {item.rating !== null && <span className="sr-only"> — ваша оценка</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
