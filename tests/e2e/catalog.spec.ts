import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Идёт на dev-базе после pnpm db:seed. Драматические ТВ-сериалы в seed: Фрирен, «Монолог фармацевта»,
// «Реинкарнация безработного»; фильм «Твоё имя» и скрытый «Ребёнок идола» под фильтр попадать не должны.
const FILTERED = "/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&kind=tv&sort=name";
const DRAMA_TV_BY_NAME = [
  "Монолог фармацевта",
  "Провожающая в последний путь Фрирен",
  "Реинкарнация безработного: История о приключениях в другом мире. Часть 2",
];

function results(page: Page) {
  return page.getByRole("list", { name: "Найденные тайтлы" }).getByRole("listitem");
}

/**
 * Чип отбора: кликаем подпись, а не сам чекбокс. Чекбокс sr-only и перекрыт своей же подписью —
 * ровно как у живого зрителя, который жмёт на слово, а не на скрытое поле.
 */
function chip(page: Page, name: string, value: string) {
  return page.locator(`label:has(input[name="${name}"][value="${value}"])`);
}

/** Метки действующего отбора над выдачей: они же кнопки «снять». */
function appliedFilters(page: Page) {
  return page.getByRole("list", { name: "Действующий отбор" }).getByRole("listitem");
}

/** Ширина, с которой панель отбора стоит колонкой и раскрыта всегда (lg в tailwind). */
const DESKTOP = 1024;

/**
 * На телефоне отбор — нижний лист, и он закрыт. Ветвимся по ширине окна, а не по видимости:
 * isVisible не ждёт и на медленном прогоне вернул бы false до отрисовки.
 */
async function openFilters(page: Page) {
  const viewport = page.viewportSize();
  if (viewport && viewport.width < DESKTOP) {
    if (!(await page.locator("#catalog-filters-open").isChecked())) {
      // Кликаем открывашку, а не чекбокс: он sr-only. Тем же htmlFor помечены затемнение и
      // крестик, поэтому отбираем по тексту.
      await page.locator('label[for="catalog-filters-open"]', { hasText: "Фильтры" }).click();
    }
  }
  // Жанров в базе бывает больше, чем помещается открытыми: остальные лежат под «ещё N».
  const more = page.locator("#catalog-filters-panel details > summary");
  if ((await more.count()) > 0) await more.first().click();
  await expect(page.getByRole("group", { name: "Жанр" })).toBeVisible();
}

/** Закрыть нижний лист: пока он открыт, он и его затемнение перекрывают всё под собой. */
async function closeFilters(page: Page) {
  if (await page.locator("#catalog-filters-open").isChecked()) {
    await page.locator('label[for="catalog-filters-open"]').filter({ hasText: "Закрыть отбор" }).last().click();
  }
}

async function expectFilteredView(page: Page) {
  await expect(page.getByRole("checkbox", { name: "Драма" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "ТВ-сериал" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Любой" })).toBeChecked();
  await expect(page.getByLabel("Год от")).toHaveValue("");
  // Без якоря в начале: перед названием в карточке стоит подпись оценки для скринридера.
  await expect(results(page)).toHaveText(DRAMA_TV_BY_NAME.map((name) => new RegExp(escapeRegExp(name))));
}

test("ссылка с фильтрами открывается в новой вкладке в том же виде", async ({ page, context }) => {
  await page.goto(FILTERED);
  await openFilters(page);
  await expectFilteredView(page);

  const tab = await context.newPage();
  await tab.goto(page.url());
  await expect(tab).toHaveURL(page.url());
  await openFilters(tab);
  await expectFilteredView(tab);
});

test("форма меняет адрес на чистый, «Сбросить» возвращает весь каталог", async ({ page }) => {
  await page.goto("/catalog");
  // Сравниваем с тем, что каталог показал до фильтров: число тайтлов в seed меняется от задачи к задаче.
  const total = await results(page).count();
  expect(total).toBeGreaterThan(DRAMA_TV_BY_NAME.length);

  await openFilters(page);
  await chip(page, "genre", "Драма").click();
  await chip(page, "kind", "tv").click();
  await page.getByRole("button", { name: "Показать" }).click();

  // Пустые поля формы (status=, year_from=) в адрес не попадают: им делятся.
  await expect(page).toHaveURL("/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&kind=tv");
  await expect(results(page)).toHaveCount(DRAMA_TV_BY_NAME.length);

  // «Сбросить» в шапке панели (Catalog.dc.html): на телефоне это внутри листа.
  await openFilters(page);
  await page.getByRole("link", { name: "Сбросить" }).click();
  await expect(page).toHaveURL("/catalog");
  await expect(results(page)).toHaveCount(total);
});

test("два жанра сразу — это «или»: выдача шире, а не пустее", async ({ page }) => {
  await page.goto("/catalog");
  await openFilters(page);

  await chip(page, "genre", "Драма").click();
  await page.getByRole("button", { name: "Показать" }).click();
  // Ждём адрес, а не просто клик: без этого счёт снялся бы ещё со старой выдачи.
  await expect(page).toHaveURL("/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0");
  const onlyDrama = await results(page).count();

  await openFilters(page);
  await chip(page, "genre", "Комедия").click();
  await page.getByRole("button", { name: "Показать" }).click();

  // Порядок повторяемых параметров канонический: жанры по алфавиту.
  await expect(page).toHaveURL(
    "/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&genre=%D0%9A%D0%BE%D0%BC%D0%B5%D0%B4%D0%B8%D1%8F",
  );
  expect(await results(page).count()).toBeGreaterThan(onlyDrama);
});

test("год диапазоном сужает выдачу и читается одной меткой", async ({ page }) => {
  await page.goto("/catalog?year_from=2023&year_to=2024");
  await expect(appliedFilters(page)).toHaveCount(1);
  await expect(appliedFilters(page).first()).toContainText("2023—2024");

  // Границы наоборот — это опечатка в ссылке, а не пустая выдача.
  await page.goto("/catalog?year_from=2024&year_to=2023");
  await expect(page).toHaveURL("/catalog?year_from=2023&year_to=2024");
});

test("метка отбора снимает ровно себя и возвращает на первую страницу", async ({ page }) => {
  await page.goto("/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&kind=tv");
  await expect(appliedFilters(page)).toHaveCount(2);

  await appliedFilters(page).filter({ hasText: "ТВ-сериал" }).getByRole("link").click();
  await expect(page).toHaveURL("/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0");
  await expect(appliedFilters(page)).toHaveCount(1);
});

test("пресет открывается прямой ссылкой и отмечен, только когда открыт ровно он", async ({ page }) => {
  await page.goto("/catalog");
  const preset = page.getByRole("navigation", { name: "Подборки" }).getByRole("link", { name: "Онгоинги" });
  await expect(preset).not.toHaveAttribute("aria-current", "page");

  await preset.click();
  await expect(page).toHaveURL("/catalog?status=ongoing");
  await expect(
    page.getByRole("navigation", { name: "Подборки" }).getByRole("link", { name: "Онгоинги" }),
  ).toHaveAttribute("aria-current", "page");

  // Пресет плюс жанр — это уже не пресет: подсвеченный чип соврал бы про то, что показано.
  await page.goto("/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&status=ongoing");
  await expect(
    page.getByRole("navigation", { name: "Подборки" }).getByRole("link", { name: "Онгоинги" }),
  ).not.toHaveAttribute("aria-current", "page");
});

test("сортировка — ссылки, работает без отправки формы", async ({ page }) => {
  await page.goto("/catalog");
  await page.locator("summary", { hasText: "Сортировка" }).click();
  await page.getByRole("link", { name: "По названию" }).click();

  await expect(page).toHaveURL("/catalog?sort=name");
  // Выбранная сортировка переживает отправку формы отбора скрытым полем.
  await openFilters(page);
  await chip(page, "genre", "Драма").click();
  await page.getByRole("button", { name: "Показать" }).click();
  await expect(page).toHaveURL("/catalog?genre=%D0%94%D1%80%D0%B0%D0%BC%D0%B0&sort=name");
});

test("черновик и скрытый по жалобе тайтл не видны ни в выдаче, ни через свои фильтры", async ({ page }) => {
  await page.goto("/catalog");
  await expect(page.getByText("Семья шпиона")).toHaveCount(0);
  await expect(page.getByText("Ребёнок идола")).toHaveCount(0);

  await openFilters(page);
  // «Сэйнэн» в seed есть только у скрытого тайтла.
  await expect(page.getByRole("checkbox", { name: "Сэйнэн" })).toHaveCount(0);
});

test("мусор, неизвестный жанр и страница за последней ведут на чистый адрес, метки кампаний сохраняются", async ({
  page,
}) => {
  const garbage = await page.goto("/catalog?year_from=abc&page=-1&status=hidden&genre=%00");
  expect(garbage?.status()).toBe(200);
  await expect(page).toHaveURL("/catalog");

  // Любой текст из ?genre= не должен становиться выбранным фильтром.
  await page.goto("/catalog?genre=%D0%9A%D0%B0%D0%BA%D0%BE%D0%B9-%D1%82%D0%BE%20%D1%82%D0%B5%D0%BA%D1%81%D1%82");
  await expect(page).toHaveURL("/catalog");

  await page.goto("/catalog?kind=tv&page=40");
  await expect(page).toHaveURL("/catalog?kind=tv");

  await page.goto("/catalog?utm_source=telegram&kind=tv&foo=bar");
  await expect(page).toHaveURL("/catalog?kind=tv&utm_source=telegram");
});

test("карточка ведёт на страницу тайтла", async ({ page }) => {
  await page.goto(FILTERED);
  await expect(results(page).first().getByRole("link")).toHaveAttribute("href", "/anime/kusuriya-no-hitorigoto");
});

test("пункт «Каталог» в шапке отмечен текущим", async ({ page }) => {
  await page.goto("/catalog");

  // На телефоне навигация живёт в свёрнутом меню, на широком экране стоит прямо в шапке.
  // Ширина — то же значение, что и у lg в разметке шапки.
  const viewport = page.viewportSize();
  if (viewport && viewport.width < DESKTOP) {
    // Элементом, а не ролью: Chrome выставляет <summary> не как button, и роль ненадёжна.
    await page.locator("header summary").click();
  }

  await expect(
    page.getByRole("navigation", { name: "Разделы" }).getByRole("link", { name: "Каталог" }),
  ).toHaveAttribute("aria-current", "page");
});

test("поиск в каталоге складывается с фильтром и не зацикливает редирект", async ({ page }) => {
  await page.goto("/catalog");
  await openFilters(page);

  // Два слова: encodeURIComponent дал бы «%20» вместо «+», и страница ушла бы в вечный редирект.
  await page.getByLabel("Название").fill("монолог фармацевта");
  await page.getByRole("button", { name: "Показать" }).click();

  await expect(page).toHaveURL(
    "/catalog?q=%D0%BC%D0%BE%D0%BD%D0%BE%D0%BB%D0%BE%D0%B3+%D1%84%D0%B0%D1%80%D0%BC%D0%B0%D1%86%D0%B5%D0%B2%D1%82%D0%B0",
  );
  // Без точного числа: по роадмапу в локальную базу зальют сотню тайтлов импортом.
  await expect(results(page).filter({ hasText: "Монолог фармацевта" })).toHaveCount(1);
  await expect(results(page).filter({ hasText: "Наруто" })).toHaveCount(0);

  // Поле переживает переход: иначе непонятно, почему в каталоге три тайтла вместо девяти.
  await openFilters(page);
  await expect(page.getByLabel("Название")).toHaveValue("монолог фармацевта");

  // «Сбросить» — в шапке панели; лист уже открыт строкой выше.
  await page.getByRole("link", { name: "Сбросить" }).click();
  await expect(page).toHaveURL("/catalog");
});

test("поиск в каталоге с фильтром сужает выдачу, пустой запрос в адрес не попадает", async ({ page }) => {
  // «Фрирен» — драма; под фильтром «Комедия» её быть не должно, и это не пустой каталог, а пустая выдача.
  await page.goto("/catalog?q=%D1%84%D1%80%D0%B8%D1%80%D0%B5%D0%BD");
  await expect(results(page).first()).toContainText("Фрирен");

  await page.goto("/catalog?q=%D1%84%D1%80%D0%B8%D1%80%D0%B5%D0%BD&genre=%D0%9A%D0%BE%D0%BC%D0%B5%D0%B4%D0%B8%D1%8F");
  await expect(page.getByText("Здесь пока пусто")).toBeVisible();

  // Поиск из индекса убран: адресов с произвольным q бесконечно много. Фильтры остаются индексируемыми.
  await page.goto("/catalog?q=%D1%84%D1%80%D0%B8%D1%80%D0%B5%D0%BD");
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.goto("/catalog?kind=tv");
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);

  // Пустое поле формы уходит как ?q=, но каноническим адресом остаётся чистый /catalog.
  await page.goto("/catalog?q=");
  await expect(page).toHaveURL("/catalog");
  await page.goto("/catalog?q=%20%20");
  await expect(page).toHaveURL("/catalog");
});

test("бейдж оценки на карточке", async ({ page }) => {
  // В seed «Фрирен» — 9.25: показываем одним знаком после запятой, с русской запятой и с округлением.
  await page.goto("/catalog?genre=%D0%A4%D1%8D%D0%BD%D1%82%D0%B5%D0%B7%D0%B8&sort=score");
  const first = results(page).first();
  await expect(first).toContainText("Провожающая в последний путь Фрирен");
  await expect(first).toContainText("9,3");
  // Цифра на постере без пояснения — это шум для скринридера.
  await expect(first.getByText("Оценка Shikimori", { exact: false })).toBeAttached();
});

test("сортировки по рейтингу и по популярности дают разный порядок", async ({ page }) => {
  // Внутри одного жанра и по относительному порядку двух тайтлов: абсолютное первое место в каталоге
  // сломается, как только в локальную базу зальют импорт, а этот инвариант — нет.
  // «Наруто» у Shikimori популярнее «Фрирен» (9-е место против 12-го), но по оценке ниже (8.02 против 9.25).
  const order = async (sort: string) => {
    await page.goto(`/catalog?genre=%D0%A4%D1%8D%D0%BD%D1%82%D0%B5%D0%B7%D0%B8&sort=${sort}`);
    const texts = await results(page).allInnerTexts();
    return {
      naruto: texts.findIndex((text) => text.includes("Наруто")),
      frieren: texts.findIndex((text) => text.includes("Фрирен")),
    };
  };

  const byPopular = await order("popular");
  const byScore = await order("score");

  expect(byPopular.naruto).toBeGreaterThanOrEqual(0);
  expect(byScore.frieren).toBeGreaterThanOrEqual(0);
  expect(byPopular.naruto).toBeLessThan(byPopular.frieren);
  expect(byScore.naruto).toBeGreaterThan(byScore.frieren);
});

test("пагинация номерами: работает с клавиатуры, за последней страницей — канонический адрес", async ({ page }) => {
  await page.goto("/catalog?sort=name");
  const pages = page.getByRole("navigation", { name: "Страницы каталога" });

  // В seed тайтлов меньше страницы, и полосы номеров тогда нет вовсе — это не ошибка.
  if ((await pages.count()) === 0) {
    await expect(results(page).first()).toBeVisible();
    return;
  }

  await pages.getByRole("link", { name: "Страница 2" }).press("Enter");
  await expect(page).toHaveURL("/catalog?sort=name&page=2");
  await expect(pages.getByText("2", { exact: true }).first()).toHaveAttribute("aria-current", "page");
});

test("на широком экране отбор стоит слева от выдачи, как на макете", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/catalog");

  const panel = await page.locator("#catalog-filters-panel").boundingBox();
  const grid = await page.getByRole("list", { name: "Найденные тайтлы" }).boundingBox();
  if (!panel || !grid) throw new Error("панель отбора или выдача не отрисованы");
  expect(panel.x + panel.width).toBeLessThanOrEqual(grid.x);
});

test("панель отбора липнет на длинной странице и остаётся в окне", async ({ page }) => {
  // Низкое окно делает страницу длиннее экрана и на seed-данных: так был виден баг, когда панель
  // уезжала вверх вместе со страницей — sticky упирался в обёртку высотой ровно в саму панель.
  await page.setViewportSize({ width: 1440, height: 500 });
  await page.goto("/catalog");
  // До последней карточки, а не до подвала: ниже выдачи колонка кончается, и липкий блок законно
  // уходит вверх вместе с ней. Баг был в том, что панель уезжала посреди выдачи.
  await page.getByRole("list", { name: "Найденные тайтлы" }).getByRole("listitem").last().scrollIntoViewIfNeeded();

  const panel = await page.locator("#catalog-filters-panel").boundingBox();
  if (!panel) throw new Error("панель отбора не отрисована");
  expect(panel.y).toBeGreaterThanOrEqual(0);
  expect(panel.y).toBeLessThan(120);
  await expect(page.getByRole("button", { name: "Показать" })).toBeInViewport();
});

test("выбранный статус и жанр подсвечиваются сразу, до «Показать»", async ({ page }) => {
  // Раньше подсветку считал сервер из адреса: клик менял радиокнопку, а глазами ничего не происходило.
  await page.goto("/catalog");
  await openFilters(page);

  const ongoing = page.locator('label:has(input[name="status"][value="ongoing"])');
  await ongoing.click();
  await expect(page.getByRole("radio", { name: "Выходит" })).toBeChecked();
  await expect(ongoing).toHaveCSS("color", "rgb(255, 176, 46)");
  await expect(page.locator('label:has(input[name="status"][value=""])')).not.toHaveCSS("color", "rgb(255, 176, 46)");

  const drama = chip(page, "genre", "Драма");
  await drama.click();
  await expect(drama).toHaveCSS("color", "rgb(255, 176, 46)");
  await expect(page).toHaveURL("/catalog");
});

test("на 360px отбор закрыт, первый ряд постеров виден сразу, лист открывается и закрывается", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/catalog");

  await expect(page.getByRole("group", { name: "Жанр" })).toBeHidden();
  const first = await results(page).first().boundingBox();
  if (!first) throw new Error("выдача пуста");
  expect(first.y).toBeLessThan(800);

  await openFilters(page);
  await closeFilters(page);
  await expect(page.getByRole("group", { name: "Жанр" })).toBeHidden();
});

test("на 360px нет горизонтального скролла", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(FILTERED);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("axe: нет нарушений critical и serious в выдаче, в пустом состоянии и в раскрытом отборе", async ({ page }) => {
  for (const url of [FILTERED, "/catalog?genre=%D0%9A%D0%BE%D0%BC%D0%B5%D0%B4%D0%B8%D1%8F&kind=movie"]) {
    await page.goto(url);
    await openFilters(page);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const blocking = violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, help, nodes }) => `${id}: ${help} (${nodes.length})`);
    expect(blocking, url).toEqual([]);
  }
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
