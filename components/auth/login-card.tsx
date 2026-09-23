import { Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { button, TEXT_LINK } from "@/components/ui/controls";
import { googleConfig } from "@/lib/auth/google";

/** Ключи Google живут только на сервере. Без обоих вход честно говорит, что пока не работает. */
const configured = googleConfig() !== null;

/**
 * Что даёт аккаунт. Линованный список, а не три одинаковые карточки: одинаковые блоки «заголовок
 * плюс текст» — это не структура, а её отсутствие.
 */
const BENEFITS = [
  ["Списки", "Смотрю, брошено, просмотрено, запланировано"],
  ["Оценки", "Своя от 1 до 10 — рядом с оценкой Shikimori"],
  ["Прогресс", "Живёт в аккаунте, а не во вкладке браузера"],
] as const;

interface LoginCardProps {
  /** id заголовка: по нему диалог называет себя для скринридера (aria-labelledby). */
  titleId: string;
  /** Крестик закрытия. */
  close?: ReactNode;
}

/**
 * Содержимое окна входа (Auth.dc.html, Auth-mobile.dc.html). Серверная: ключ Google читается
 * здесь и в клиентский бандл не попадает.
 */
export function LoginCard({ titleId, close }: LoginCardProps) {
  return (
    <div className="flex flex-col gap-5 p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-xl leading-tight font-bold tracking-tight sm:text-2xl">
            Вход в AnimeWatch
          </h2>
          <p className="mt-2.5 text-base text-muted">
            Каталог, поиск и просмотр работают без аккаунта. Вход нужен, чтобы сайт помнил вас — и ни для чего больше.
          </p>
        </div>
        {close}
      </div>

      <div className="flex flex-col gap-3">
        {configured ? (
          // Ссылка, а не кнопка: уход на сторону Google — это переход, и он обязан работать без JS.
          <a href="/api/auth/google" className={GOOGLE_BUTTON}>
            <GoogleMark />
            Продолжить с Google
          </a>
        ) : (
          <>
            <button
              type="button"
              disabled
              aria-describedby={`${titleId}-pending`}
              className={`${button("disabled")} w-full`}
            >
              <GoogleMark />
              Продолжить с Google
            </button>
            {/*
              Вход подключается прямо сейчас — это и есть «сейчас», поэтому плашка янтарная. Текст
              на ней тоном от янтаря, а не серым: серое на цветной плашке — признак собранной страницы.
            */}
            <p
              id={`${titleId}-pending`}
              className="flex items-start gap-2.5 rounded-md border border-signal-line bg-signal-soft px-3.5 py-3 text-sm text-signal-muted"
            >
              <Info aria-hidden="true" className="mt-px size-4.5 shrink-0 text-signal" />
              Вход ещё подключается. Каталог и поиск работают и без аккаунта.
            </p>
          </>
        )}
      </div>

      <div>
        <p className="mb-2.5 text-xs text-dim">Что даёт аккаунт</p>
        {/* Плотная поверхность: даже внутри стеклянной модалки список стоит на своей подложке. */}
        <dl className="overflow-hidden rounded-md border border-line bg-surface">
          {BENEFITS.map(([name, note]) => (
            <div
              key={name}
              className="flex min-h-13 flex-col justify-center gap-0.5 border-b border-line px-4 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <dt className="text-base font-medium">{name}</dt>
              <dd className="text-xs text-dim sm:text-right">{note}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="text-xs text-dim">
        <p>
          Отдельной регистрации нет: первый вход через Google сразу создаёт аккаунт. Продолжая, вы соглашаетесь с{" "}
          <Link href="/terms" className={TEXT_LINK}>
            пользовательским соглашением
          </Link>{" "}
          и{" "}
          <Link href="/privacy" className={TEXT_LINK}>
            политикой конфиденциальности
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/**
 * Кнопка Google — белая, как на макете: это единственная кнопка на сайте, которая принадлежит
 * чужой марке, и она не должна притворяться нашим главным действием в янтаре.
 */
const GOOGLE_BUTTON =
  "inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-md bg-text px-5 text-md font-semibold text-bg hover:bg-text-2";

/**
 * Знак Google — официальный цветной «G» из их правил для кнопки входа. Лежит файлом в public:
 * у знака свои цвета, и в разметку их тащить незачем.
 */
function GoogleMark() {
  // eslint-disable-next-line @next/next/no-img-element -- 20px векторного знака: оптимизатору нечего делать
  return <img src="/icons/google.svg" alt="" width={20} height={20} className="size-5 shrink-0" />;
}
