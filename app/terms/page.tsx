import type { Metadata } from "next";
import Link from "next/link";

import { PAGE_TITLE, TEXT_LINK } from "@/components/ui/controls";
import { siteContactEmail } from "@/lib/site/contact";

export const metadata: Metadata = {
  title: "Пользовательское соглашение",
  description: "Условия использования сайта AnimeWatch.",
  alternates: { canonical: "/terms" },
};

// Текст меняется редко: сутки в кеше, точечный сброс не нужен.
export const revalidate = 86_400;

export default function TermsPage() {
  const email = siteContactEmail();

  return (
    <article className="mx-auto max-w-page px-4 lg:px-8 py-6 md:py-10">
      <h1 className={PAGE_TITLE}>Пользовательское соглашение</h1>
      <p className="mt-2 text-sm text-dim">Редакция от 18 сентября 2026 года</p>

      <div className="mt-8 max-w-[70ch] space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Что это за сайт</h2>
          <p>
            AnimeWatch — каталог аниме с плеером. Мы не храним и не раздаём видеофайлы: каталог собран из открытых
            источников метаданных, а воспроизведение идёт во фрейме сторонних поставщиков видео. Права на произведения
            принадлежат их правообладателям; сайт не передаёт и не продаёт эти права.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Как можно пользоваться сайтом</h2>
          <p>Можно смотреть материалы для личного просмотра и делиться ссылками на страницы сайта. Нельзя:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>скачивать материалы и публиковать их под своим именем;</li>
            <li>автоматически выгружать каталог и мешать работе сайта нагрузкой.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Регистрация</h2>
          <p>
            Смотреть можно без регистрации, и никаких данных для этого мы не спрашиваем. Вход нужен только для
            списков и оценок и будет через аккаунт Google — отдельной регистрации нет. Когда он заработает, этот раздел
            изменится вместе с политикой конфиденциальности.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Обращения правообладателей</h2>
          <p>
            Если вы считаете, что размещённый материал нарушает ваши права, отправьте{" "}
            <Link href="/dmca" className="text-text underline">
              обращение правообладателя
            </Link>
            . По подтверждённому обращению тайтл скрывается целиком вместе со всеми сериями.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Ответственность и изменения</h2>
          <p>
            Сайт работает как есть: мы не обещаем непрерывной доступности и сохранности данных просмотра. Условия могут
            меняться; действует та редакция, которая опубликована на этой странице.
          </p>
          <p className="text-muted">
            Как мы обращаемся с данными, описано в{" "}
            <Link href="/privacy" className="text-text underline">
              политике конфиденциальности
            </Link>
            .
          </p>
        </section>

        {email && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Связаться с нами</h2>
            <p>
              <a href={`mailto:${email}`} className={TEXT_LINK}>
                {email}
              </a>
            </p>
          </section>
        )}
      </div>
    </article>
  );
}
