import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { AuthTrigger } from "@/components/auth/auth-trigger";
import { button, PAGE_TITLE } from "@/components/ui/controls";

export const metadata: Metadata = {
  title: "Не получилось войти",
  robots: { index: false, follow: false },
};

const reasonSchema = z.enum(["denied", "state", "google", "unavailable"]).catch("google");

/** Что случилось и что делать (docs/04, «Текст в интерфейсе»): не «ошибка», а причина и шаг. */
const MESSAGES: Record<z.infer<typeof reasonSchema>, { title: string; text: string }> = {
  denied: {
    title: "Вход отменён",
    text: "Вы отменили вход на странице Google. Каталог, поиск и просмотр работают и без аккаунта.",
  },
  state: {
    title: "Вход устарел",
    text: "Вход длился дольше десяти минут или был начат в другой вкладке. Начните его заново.",
  },
  google: {
    title: "Google не ответил",
    text: "Не получилось получить данные аккаунта. Попробуйте ещё раз через минуту.",
  },
  unavailable: {
    title: "Вход ещё подключается",
    text: "Вход через Google на сайте пока не включён. Каталог, поиск и просмотр работают и без аккаунта.",
  },
};

/**
 * Куда ведёт неудачный вход (app/api/auth/google/callback). Это не страница входа — вход только
 * окном (docs/02), — а место для ошибки, которое работает и без JS.
 */
export default async function AuthErrorPage({ searchParams }: PageProps<"/auth/error">) {
  const reason = reasonSchema.parse((await searchParams).reason);
  const { title, text } = MESSAGES[reason];

  return (
    <div className="mx-auto max-w-page px-4 py-10 md:py-16 lg:px-8">
      <h1 className={PAGE_TITLE}>{title}</h1>
      <p className="mt-3 max-w-[60ch] text-md text-text-2">{text}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {reason !== "unavailable" && <AuthTrigger className={button()}>Попробовать снова</AuthTrigger>}
        <Link href="/" className={button("secondary")}>
          На главную
        </Link>
      </div>
    </div>
  );
}
