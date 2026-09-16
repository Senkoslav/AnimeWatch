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

export const metadata: Metadata = {
  title: { default: "BebraDub", template: "%s — BebraDub" },
  description: "Аниме в озвучке студии BebraDub",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${golos.variable} ${unbounded.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#content"
          className="sr-only rounded-sm bg-text text-bg focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:inline-flex focus:min-h-11 focus:items-center focus:px-4"
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
