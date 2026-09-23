/**
 * Окно видимых серий. У долгих тайтлов их тысяча с лишним («Ван-Пис» — 1178), и список целиком
 * превращает страницу тайтла в километр разметки. Настоящая пагинация — отдельная задача роадмапа,
 * до неё показываем окно и честно пишем, какое именно.
 */

/** Сколько серий помещается на странице тайтла, не ломая её вес. */
export const EPISODE_WINDOW = 100;

/**
 * Сколько плиток стоит рядом с плеером. Колонка липкая и не выше окна: 48 плиток — восемь рядов
 * по шесть, и текущая серия в середине окна видна без прокрутки внутри колонки.
 */
export const WATCH_EPISODE_WINDOW = 48;

export interface EpisodeWindow<T> {
  episodes: T[];
  /** Список урезан: страница обязана сказать об этом, иначе выглядит как потеря серий. */
  capped: boolean;
  first: number;
  last: number;
  total: number;
}

/**
 * Последние серии, а если человек смотрит конкретную — окно вокруг неё, текущая в середине.
 * Первая серия остаётся доступной кнопкой «Смотреть», а вот последняя из тысячи иначе
 * недостижима вообще.
 */
export function episodeWindow<T extends { number: number }>(
  episodes: T[],
  currentNumber?: number,
  size: number = EPISODE_WINDOW,
): EpisodeWindow<T> {
  const total = episodes.length;
  if (total <= size) {
    return { episodes, capped: false, first: episodes[0]?.number ?? 0, last: episodes.at(-1)?.number ?? 0, total };
  }

  const currentIndex = currentNumber ? episodes.findIndex((episode) => episode.number === currentNumber) : -1;
  const end = currentIndex >= 0 ? Math.min(total, Math.max(currentIndex + Math.ceil(size / 2), size)) : total;
  const visible = episodes.slice(Math.max(0, end - size), end);

  return {
    episodes: visible,
    capped: true,
    first: visible[0]?.number ?? 0,
    last: visible.at(-1)?.number ?? 0,
    total,
  };
}
