import type { Metadata } from "next";
import { Golos_Text, Unbounded } from "next/font/google";
import type { ReactNode } from "react";

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
});

export const metadata: Metadata = {
  title: { default: "BebraDub", template: "%s — BebraDub" },
  description: "Аниме в озвучке студии BebraDub",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${golos.variable} ${unbounded.variable}`}>
      <body>{children}</body>
    </html>
  );
}
