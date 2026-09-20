import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Вход",
  // Страница входа в поиске не нужна и плодит дубли с параметрами возврата.
  robots: { index: false, follow: true },
};

/** Ключи Google живут только на сервере. Без них вход честно говорит, что пока не работает. */
const configured = Boolean(process.env.GOOGLE_CLIENT_ID);

const BENEFITS = [
  ["Списки", "Отмечайте, что смотрите, что бросили и что досмотрели."],
  ["Оценки", "Своя оценка от 1 до 10 рядом с оценкой Shikimori."],
  ["Продолжить с любого устройства", "Прогресс живёт в аккаунте, а не во вкладке."],
] as const;

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <div className="overflow-hidden rounded-md border border-line bg-surface md:grid md:grid-cols-2">
        {/* Слева — что вход даёт. Обещаний про качество видео здесь нет: его отдаёт плеер поставщика. */}
        <section className="border-b border-line p-6 md:border-r md:border-b-0 md:p-8">
          <h2 className="font-display text-xl font-bold">Свой список аниме</h2>
          <p className="mt-3 max-w-[40ch] text-muted">
            Аккаунт нужен для того, чтобы каталог помнил вас — и ни для чего больше.
          </p>

          <ul className="mt-6 space-y-3">
            {BENEFITS.map(([name, description]) => (
              <li key={name} className="rounded-sm border border-line bg-bg p-3">
                <p className="text-sm font-medium">{name}</p>
                <p className="mt-1 text-sm text-muted">{description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="p-6 md:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="font-display text-xl font-bold">Вход в аккаунт</h1>
            <Link href="/" className="rounded-sm text-sm text-muted underline hover:text-text">
              Закрыть
            </Link>
          </div>

          {configured ? (
            // Ссылка, а не кнопка: уход на сторону Google — это переход, и он обязан работать без JS.
            <a
              href="/api/auth/google"
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-text px-5 font-medium text-bg hover:bg-muted"
            >
              Войти через Google
            </a>
          ) : (
            <>
              <button
                type="button"
                disabled
                className="mt-6 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-sm border border-line bg-bg px-5 font-medium text-muted"
              >
                Войти через Google
              </button>
              {/* Говорим, что произошло и что делать, а не «ошибка» (docs/04, «Текст в интерфейсе»). */}
              <p className="mt-3 text-sm text-muted">Вход ещё подключается. Каталог и поиск работают и без аккаунта.</p>
            </>
          )}

          <p className="mt-6 text-sm text-muted">
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
        </section>
      </div>
    </div>
  );
}
