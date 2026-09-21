import type { Metadata } from "next";
import Link from "next/link";

import { button, TEXT_LINK } from "@/components/ui/controls";
import { SectionHeading } from "@/components/ui/section-heading";

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
      {/* Плотная поверхность: страница входа стоит на пустом фоне, размывать ей нечего. */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface md:grid md:grid-cols-[1fr_1fr]">
        <section className="border-b border-line md:border-r md:border-b-0">
          <div className="border-b border-line px-4 py-3 md:px-6">
            <SectionHeading>Зачем аккаунт</SectionHeading>
          </div>
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
          <div className="border-b border-line px-4 py-3 md:px-6">
            <SectionHeading as="h1">Вход в аккаунт</SectionHeading>
          </div>
          <div className="p-4 md:p-6">
            {configured ? (
              // Ссылка, а не кнопка: уход на сторону Google — это переход, и он обязан работать без JS.
              <a href="/api/auth/google" className={`${button()} w-full`}>
                Войти через Google
              </a>
            ) : (
              <>
                <button type="button" disabled className={`${button("disabled")} w-full`}>
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
              <Link href="/terms" className={TEXT_LINK}>
                пользовательским соглашением
              </Link>{" "}
              и{" "}
              <Link href="/privacy" className={TEXT_LINK}>
                политикой конфиденциальности
              </Link>
              .
            </p>
            <p className="mt-6">
              <Link href="/" className="inline-flex min-h-11 items-center text-sm text-dim underline hover:text-text">
                Вернуться в каталог
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
