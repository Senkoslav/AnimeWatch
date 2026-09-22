import type { Metadata } from "next";
import { Golos_Text, Unbounded } from "next/font/google";

import { BottomNav } from "@/components/site/bottom-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

import "./globals.css";

const golos = Golos_Text({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-golos",
  display: "swap",
});

const unbounded = Unbounded({
  subsets: ["cyrillic", "latin"],
  weight: ["600", "700"],
  variable: "--font-unbounded",
  display: "swap",
  // Нужен только логотипу и номеру серии; предзагрузка отнимала полосу у постеров и тянула LCP.
  preload: false,
});

/**
 * Контракт направления. HTML-комментарий, а не JSX-комментарий: последний стирается сборкой,
 * и проверить по собранной странице было бы нечего (ключ жеребьёвки grep-ается в .next).
 */
const DIRECTION_CONTRACT = `<!--
THESIS: каталог, который смотрят в темноте с телефона, — холодный графит, где единственный
янтарный сигнал помечает то, что происходит прямо сейчас, а цвет на страницу приносят постеры.
Отказ от того, что ставит категория: тёмно-фиолетовый фон, градиент в герое, неоновый акцент
и стеклянные карточки везде.
OWN-WORLD: «Ночное стекло». Графитовая база, один янтарь со строгим законом («сейчас»: свежая
серия, играющая строка, действующий фильтр, оценка, текущая страница) и стекло трёх уровней,
которое кладётся только туда, где под слоем реально есть изображение или прокрученная страница.
От прошлого мира остаются линованные списки: номер в фиксированном поле слева, хронометраж
справа, пустое место рисуется ячейкой-призраком, а не пробелом.
STORY: зритель видит, что каталог настоящий и упорядоченный, верит, что нужное найдётся,
и уходит в серию за два действия.
FIRST VIEWPORT: липкая шапка стеклом над страницей; под ней кадр последней серии с номером
на стекле; ниже заголовок раздела с янтарной засечкой и лента свежего постерами.
FORM: «Ночное стекло», третий мир проекта; первые два и причины отказа — в docs/04.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`;

export const metadata: Metadata = {
  title: { default: "AnimeWatch", template: "%s — AnimeWatch" },
  description: "Аниме онлайн: каталог, поиск и просмотр с русской озвучкой",
};

/**
 * `auth` — параллельный слот модалки входа (app/@auth). Пустой везде, кроме клиентского перехода
 * на /login: тогда в нём окно входа поверх текущей страницы, а `children` остаётся прежним.
 */
export default function RootLayout({ children, auth }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${golos.variable} ${unbounded.variable}`}>
      {/* Снизу на телефоне место под нижнюю панель: без него она закрыла бы конец подвала. */}
      <body className="flex min-h-dvh flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <a
          href="#content"
          className="sr-only rounded-sm bg-signal font-medium text-signal-ink focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4"
        >
          К содержанию
        </a>
        <SiteHeader />
        <main id="content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <BottomNav />
        {auth}
      </body>
    </html>
  );
}
