import { formatScore } from "@/lib/format";
import { WATCH_STATE_LABELS } from "@/lib/labels";

import type { Reason } from "./score";

/** Почему советуем — одной строкой под карточкой (docs/04, «Текст в интерфейсе»: что и почему). */
export function reasonText(reason: Reason): string {
  switch (reason.type) {
    case "sequel":
      return `Продолжение «${reason.of}»`;
    case "similar":
      return reason.rating !== null
        ? `Похоже на «${reason.of}» — вы поставили ${reason.rating}`
        : `Похоже на «${reason.of}» из списка «${WATCH_STATE_LABELS[reason.state]}»`;
    case "genres": {
      // Жанры приходят в именительном падеже, а склонять их надёжно нельзя («выбираете драма»):
      // формулировка без падежа.
      const [first, second] = reason.genres.map((genre) => genre.toLocaleLowerCase("ru"));
      return second ? `Ваши жанры: ${first} и ${second}` : `Ваш жанр: ${first}`;
    }
    case "popular":
      return reason.score !== null ? `Оценка Shikimori ${formatScore(reason.score)}` : "Популярно на Shikimori";
  }
}
