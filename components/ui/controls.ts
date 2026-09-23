/**
 * Кнопки, поля и чипы одним набором классов на весь сайт (docs/04, «Компоненты»).
 *
 * Классы, а не компоненты: одно и то же действие бывает `<button>`, `<a>` и `<Link>`, и обёртка
 * вокруг каждого из трёх стоила бы больше, чем экономит. Тот же приём, что у
 * `components/catalog/panel.ts`.
 *
 * Вид и размер выбираются параметрами, а не дописыванием утилит поверх: `px-4` рядом с `px-5` из
 * набора — это не переопределение, а два правила одного веса, и кто победит, решает порядок в
 * собранном CSS, а не порядок в разметке.
 *
 * Тач-цель нигде не меньше 44×44 — поэтому даже у маленького размера `min-h-11`.
 */

type ButtonVariant = "primary" | "secondary" | "quiet" | "disabled";
type ButtonSize = "md" | "sm";

const BUTTON_BASE = "inline-flex items-center justify-center gap-2 text-center";

const BUTTON_SIZE: Record<ButtonSize, string> = {
  md: "min-h-12 rounded-md px-5 text-md font-semibold",
  sm: "min-h-11 rounded-sm px-4 text-sm font-medium",
};

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  /**
   * Главное действие: янтарная заливка. Единственное место, где сигнал заливает целый элемент —
   * кнопка «Смотреть» и есть то самое «сейчас», к которому зритель пришёл.
   */
  primary: "bg-signal text-signal-ink hover:bg-signal/90",
  /** Вторичное: светлая плёнка с границей. Цвета не берёт — на странице он один и уже занят. */
  secondary: "border border-line bg-fill text-text hover:bg-fill-2",
  /** Третичное: только текст. Действие, которое не должно выглядеть кнопкой. */
  quiet: "text-muted hover:text-text",
  /**
   * Выключенная кнопка. Приглушённый текст, но не выцветание: причина всегда стоит текстом рядом,
   * иначе выключенная кнопка молчит (docs/04, «Текст в интерфейсе»).
   */
  disabled: "cursor-not-allowed border border-line bg-fill/50 text-dim",
};

export function button(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `${BUTTON_BASE} ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]}`;
}

/**
 * Поле ввода и `<select>`. 16px — не из шкалы, а из поведения iOS Safari: на шрифте мельче он
 * увеличивает страницу при фокусе, и зритель оказывается в зумленном каталоге.
 */
const FIELD_BASE = "w-full min-w-0 rounded-sm border border-line bg-bg/60 text-[1rem] text-text";

export const FIELD = `${FIELD_BASE} h-12 px-3.5 sm:h-11`;

/** Поле в шапке: тот же кегль, но ниже — строка шапки всего 56–64. */
export const FIELD_COMPACT = `${FIELD_BASE} h-10 px-3`;

/** Подпись над полем. */
export const FIELD_LABEL = "text-sm font-medium text-text-2";

/**
 * Чип: жанр, тип, пресет, метка действующего отбора. На телефоне это тач-цель, на десктопе —
 * плотная строка, поэтому высота ужимается только с `sm`.
 */
const CHIP_BASE = "inline-flex min-h-11 items-center gap-2 rounded-sm border px-3 text-sm font-medium sm:min-h-9";

export const CHIP = `${CHIP_BASE} border-line bg-fill text-text-2 hover:bg-fill-2 hover:text-text`;

/** Выбранный чип — янтарь: отбор, который действует прямо сейчас, и есть «сейчас». */
export const CHIP_ACTIVE = `${CHIP_BASE} border-signal-line bg-signal-soft text-signal`;

/**
 * Чип с чекбоксом внутри (жанр, тип в отборе). Как у сегмента: выбранный красится от `:checked`
 * поля, чтобы клик был виден сразу, до отправки формы.
 */
// relative у чипа и сегмента с полем внутри — не оформление: поле sr-only позиционировано
// абсолютно, и без него его точкой отсчёта становилась липкая панель отбора. Фокус на поле
// прокручивал тогда саму панель, а не область полей, и шапка уезжала вверх.
export const CHIP_CHECKABLE = `${CHIP} relative has-[:checked]:border-signal-line has-[:checked]:bg-signal-soft has-[:checked]:text-signal`;

/**
 * Метка: выходные данные рядом с заголовком (год, тип, число серий). Выглядит как чип, но это не
 * ссылка и не поле, поэтому без ховера и без тач-цели — нажимать на неё нечего.
 */
const TAG_BASE = "inline-flex min-h-8 items-center gap-2 rounded-sm border px-3 text-sm";
export const TAG = `${TAG_BASE} border-line bg-fill text-text-2`;

/** Метка того, что происходит сейчас: «выходит», «вышло 3 часа назад». Точка повторяет смысл формой. */
export const TAG_SIGNAL = `${TAG_BASE} border-signal-line bg-signal-soft font-semibold text-signal`;

/**
 * Сегментированный переключатель: одно значение из нескольких, собран из радиокнопок.
 *
 * Сетка, а не строка: в колонке отбора шириной 19rem четыре варианта в ряд не помещаются, и
 * последний обрезался. Два на два читаются как одна группа и не зависят от длины подписи.
 */
export const SEGMENT = "grid grid-cols-2 gap-1 rounded-md border border-line bg-bg/55 p-1";
const SEGMENT_ITEM_BASE =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-sm px-2 text-center text-sm sm:min-h-9";
/**
 * Пункт сегмента с радиокнопкой внутри. Выбранный красится от `:checked` самого поля, а не от
 * значения в адресе: иначе клик меняет выбор, а глазами ничего не происходит до «Показать».
 */
export const SEGMENT_ITEM = `${SEGMENT_ITEM_BASE} relative border border-transparent text-muted hover:text-text has-[:checked]:border-signal-line has-[:checked]:bg-signal-soft has-[:checked]:font-semibold has-[:checked]:text-signal`;

/**
 * Заголовок страницы. На телефоне на ступень мельче: Unbounded — широкая дисплейная гарнитура, и
 * «Конфиденциальности» в 28px не влезает в 360 одним словом и не переносится. Переносы по слогам
 * включены на случай слов ещё длиннее — язык страницы задан на <html>.
 */
export const PAGE_TITLE = "font-display text-xl font-bold tracking-tight text-balance hyphens-auto sm:text-2xl";

/**
 * Ссылка внутри текста. Подчёркивание остаётся всегда: ссылка, опознаваемая только цветом,
 * не опознаётся при дальтонизме, а цвет здесь один и занят сигналом.
 */
export const TEXT_LINK = "text-text underline hover:text-signal";

/** Видимый фокус у элемента, поле которого спрятано внутри (чип с чекбоксом, сегмент с радио). */
export const FOCUS_WITHIN =
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-signal";
