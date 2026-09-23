import { formatCount, formatScore } from "@/lib/format";

/** Высота самого высокого столбца, px. Пустая оценка — полоска в 2px: пустое место рисуется. */
const MAX_HEIGHT = 120;
const TITLES = ["тайтл", "тайтла", "тайтлов"] as const;

interface RatingBarsProps {
  /** Сколько тайтлов получило оценку 1…10. */
  ratings: number[];
  average: number;
}

/**
 * Распределение своих оценок (docs/04, «Диаграммы»): столбцы одного тона со скруглением 4px
 * сверху, число только у пикового, средняя — вертикальной линией на своём месте шкалы.
 *
 * Тон — янтарь: оценка по закону мира — сигнал. Одна серия, поэтому легенды нет — её называет
 * заголовок. Подсказка при наведении ничего не прячет: те же числа — в таблице для скринридера.
 */
export function RatingBars({ ratings, average }: RatingBarsProps) {
  const max = Math.max(...ratings, 1);
  const peak = ratings.indexOf(Math.max(...ratings));
  // Пустая оценка — полоска в 2px, непустая — не ниже 4px, чтобы скругление было видно.
  const heights = ratings.map((count) => (count > 0 ? Math.max((count / max) * MAX_HEIGHT, 4) : 2));
  // Столбцы 1…10 делят ширину поровну: средняя 7,9 стоит между 7 и 8 на 0,9 шага от центра 7.
  const averageLeft = ((average - 0.5) / ratings.length) * 100;

  return (
    <figure>
      <div className="relative pt-10" aria-hidden="true">
        <div className="grid h-[120px] grid-cols-10 items-end gap-1.5">
          {ratings.map((count, index) => (
            <div key={index} className="group relative flex h-full items-end justify-center">
              {index === peak && count > 0 && (
                // Число стоит над вершиной пика, вне потока: колонка ровно высотой шкалы, и подписи
                // 1–10 под ней не наползают на столбцы. Фон поверхности — под линией средней.
                <span
                  className="absolute z-10 bg-surface px-1 text-xs font-semibold text-text tabular-nums"
                  style={{ bottom: `${(heights[index] ?? 0) + 4}px` }}
                >
                  {count}
                </span>
              )}
              <span
                className={`block w-full max-w-10 rounded-t-[4px] ${count > 0 ? "bg-signal group-hover:bg-signal/80" : "bg-fill-2"}`}
                style={{ height: `${heights[index] ?? 2}px` }}
              />
              {/* Подсказка при наведении: значение крупно, подпись следом (dataviz: values lead). */}
              <span className="glass-modal pointer-events-none absolute bottom-full z-10 mb-2 hidden rounded-sm border border-fill-2 px-2.5 py-1.5 text-xs whitespace-nowrap group-hover:block">
                <span className="font-semibold text-text">{formatCount(count, TITLES)}</span>
                <span className="text-dim"> — оценка {index + 1}</span>
              </span>
            </div>
          ))}
        </div>
        {/*
          Средняя — линия поперёк шкалы оценок. Подпись стоит по ту сторону линии, где есть место:
          у высоких средних — слева от неё, иначе на узком экране она вылезла бы за край страницы.
        */}
        <div className="pointer-events-none absolute top-0 bottom-0 w-px" style={{ left: `${averageLeft}%` }}>
          <span
            className={`absolute top-0 text-xs whitespace-nowrap text-signal-muted ${average > 5.5 ? "right-1.5" : "left-1.5"}`}
          >
            средняя {formatScore(average)}
          </span>
          <span className="absolute top-5 bottom-0 left-0 border-l border-dashed border-text-2" />
        </div>
      </div>
      <div aria-hidden="true" className="mt-1 grid grid-cols-10 gap-1.5 border-t border-line pt-2.5 text-center text-xs text-dim tabular-nums">
        {ratings.map((_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>

      {/* Скрыта обёртка, а не таблица: у <table> ширина 1px из sr-only не держится, таблица
          растягивается по содержимому и выдавливает страницу вбок на узком экране. */}
      <div className="sr-only">
        <table>
          <caption>Сколько тайтлов получило каждую оценку, средняя {formatScore(average)}</caption>
          <tbody>
            {ratings.map((count, index) => (
              <tr key={index}>
                <th scope="row">Оценка {index + 1}</th>
                <td>{formatCount(count, TITLES)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-3 text-xs text-dim">
        Своя оценка от 1 до 10. Оценка Shikimori живёт отдельно и в это распределение не входит.
      </figcaption>
    </figure>
  );
}
