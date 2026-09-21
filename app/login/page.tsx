import type { Metadata } from "next";
import Link from "next/link";

import { Band } from "@/components/ui/band";

export const metadata: Metadata = {
  title: "Вход",
  // Страница входа в поиске не нужна и плодит дубли с параметрами возврата.
  robots: { index: false, follow: true },
};

/** Ключи Google живут только на сервере. Без них вход честно говорит, что пока не работает. */
const configured = Boolean(process.env.GOOGLE_CLIENT_ID);

/**
 * Что даёт аккаунт. Список, а не три одинаковые карточки: одинаковые блоки «заголовок плюс текст»
 * — это не структура страницы, а её отсутствие. Здесь та же линованная сетка, что у серий.
 */
const BENEFITS = [
  ["Списки", "Смотрю, брошено, просмотрено, запланировано."],
  ["Оценки", "Своя от 1 до 10 — рядом с оценкой Shikimori."],
  ["Прогресс", "Живёт в аккаунте, а не во вкладке браузера."],
] as const;

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <div className="overflow-hidden rounded-md border border-line bg-surface md:grid md:grid-cols-[1fr_1fr]">
        <section className="border-b border-line md:border-r md:border-b-0">
          <Band>Зачем аккаунт</Band>
          <div className="p-4 md:p-6">
            <p className="max-w-[38ch] text-muted">
              Каталог, поиск и просмотр работают без входа. Аккаунт нужен, чтобы сайт помнил вас — и ни для чего больше.
            </p>

            <dl className="mt-5 border-t border-line">
              {BENEFITS.map(([name, description]) => (
                <div key={name} className="row-ruled min-h-12 border-b border-line py-2">
                  <dt className="text-sm font-medium">{name}</dt>
                  <dd className="min-w-0 text-sm text-muted">{description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section>
          <Band as="h1">Вход в аккаунт</Band>
          <div className="p-4 md:p-6">
            {configured ? (
              // Ссылка, а не кнопка: уход на сторону Google — это переход, и он обязан работать без JS.
              <a
                href="/api/auth/google"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-text px-5 font-medium text-bg hover:bg-muted"
              >
                Войти через Google
              </a>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-sm border border-line bg-bg px-5 font-medium text-muted"
                >
                  Войти через Google
                </button>
                {/* Говорим, что произошло и что делать, а не «ошибка». */}
                <p className="mt-3 text-sm text-muted">
                  Вход ещё подключается. Каталог и поиск работают и без аккаунта.
                </p>
              </>
            )}

            <p className="mt-6 border-t border-line pt-4 text-sm text-muted">
              Отдельной регистрации нет: первый вход через Google сразу создаёт аккаунт.
            </p>
            <p className="mt-3 text-sm text-muted">
              Входя, вы соглашаетесь с{" "}
              <Link href="/terms" className="text-text underline">
                пользовательским соглашением
              </Link>{" "}
              и{" "}
              <Link href="/privacy" className="text-text underline">
                политикой конфиденциальности
              </Link>
              .
            </p>
            <p className="mt-6">
              <Link href="/" className="text-sm text-muted underline hover:text-text">
                Вернуться в каталог
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
