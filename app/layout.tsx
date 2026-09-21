import type { Metadata } from "next";
import { Golos_Text, Unbounded } from "next/font/google";
import type { ReactNode } from "react";

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
THESIS: каталог как разворот буклета к изданию — всё пронумеровано, у всего есть хронометраж,
и плотность сама доказывает, что коллекция настоящая. Отказ от того, что ставит категория:
сетки постеров на почти-чёрном с неоновым свечением и ховер-увеличением.
OWN-WORLD: тёмный печатный картон, одна зелёная офсетная краска, владеющая целыми полосами,
заливками разделов и активными строками. Линованные списки: номер в фиксированном поле слева,
хронометраж прижат к правому. Недоступное уходит в половинную плотность, пустое рисуется
ячейкой-призраком, а не пробелом.
STORY: зритель видит, что каталог настоящий и упорядоченный, верит, что нужное найдётся,
и уходит в серию за два действия.
FIRST VIEWPORT: полоса в краске с названием раздела и счётчиком; под ней линованный список
новых серий — номер, название, хронометраж; справа рейка недавно добавленного корешками.
FORM: «Вкладыш», кандидат 5 из 7 в списке по узнаваемости, ключ жеребьёвки fcbe123f.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`;

export const metadata: Metadata = {
  title: { default: "AnimeWatch", template: "%s — AnimeWatch" },
  description: "Аниме онлайн: каталог, поиск и просмотр с русской озвучкой",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${golos.variable} ${unbounded.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <a
          href="#content"
          className="sr-only rounded-sm bg-text text-bg focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-30 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4"
        >
          К содержанию
        </a>
        <SiteHeader />
        <main id="content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
