import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getRandomTitleSlug } from "@/lib/queries/random";
import { titleHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Случайное аниме",
  // Сама страница — только редирект, индексировать в ней нечего.
  robots: { index: false, follow: true },
};

// Каждый заход — новый тайтл: статика отдала бы один и тот же всем.
export const dynamic = "force-dynamic";

/**
 * «Случайное» из шапки: редирект на случайный публичный тайтл. Страница, а не app/api: снаружи её
 * никто не вызывает (docs/02, «Маршруты»). Пустой каталог уводит в каталог, а не в 404.
 */
export default async function RandomPage() {
  const slug = await getRandomTitleSlug();
  redirect(slug ? titleHref(slug) : "/catalog");
}
