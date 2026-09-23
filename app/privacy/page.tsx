import type { Metadata } from "next";
import Link from "next/link";

import { PAGE_TITLE, TEXT_LINK } from "@/components/ui/controls";
import { siteContactEmail } from "@/lib/site/contact";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Какие данные собирает AnimeWatch и что с ними происходит.",
  alternates: { canonical: "/privacy" },
};

export const revalidate = 86_400;

export default function PrivacyPage() {
  const email = siteContactEmail();

  return (
    <article className="mx-auto max-w-page px-4 lg:px-8 py-6 md:py-10">
      <h1 className={PAGE_TITLE}>Политика конфиденциальности</h1>
      <p className="mt-2 text-sm text-dim">Редакция от 18 сентября 2026 года</p>

      <div className="mt-8 max-w-[70ch] space-y-8">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Что мы храним</h2>
          <p>
            Аккаунтов на сайте пока нет, и для просмотра мы не просим о себе ничего. Единственное, что попадает в нашу
            базу от посетителя, — обращение правообладателя, если он его отправил.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Обращения из формы на странице{" "}
              <Link href="/dmca" className="text-text underline">
                обращения правообладателя
              </Link>
              : имя, адрес для ответа, правообладатель, ссылка и текст обращения. Адрес отправителя сохраняется только в
              виде хеша — он нужен, чтобы ограничить поток обращений с одного источника, и восстановить из него адрес
              нельзя.
            </li>
          </ul>
          <p className="text-muted">
            Когда появятся аккаунты, закладки и продолжение просмотра на другом устройстве, здесь появится список того,
            что для этого хранится. Пока такого хранения нет.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Чего мы не делаем</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Не продаём и не передаём данные третьим лицам для рекламы.</li>
            <li>Не собираем историю просмотра: сайт не знает, что и сколько вы смотрели.</li>
            <li>Не просим и не храним пароли: вход, когда заработает, будет через аккаунт Google.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Кто ещё видит ваши запросы</h2>
          <p>
            Видео мы не храним и не раздаём: плеер открывается во фрейме стороннего поставщика. При просмотре его
            серверы видят ваш IP-адрес и то, какое видео запрошено, и действует его собственная политика. Шрифты и
            картинки интерфейса сайт отдаёт со своего домена; постеры приходят из открытого каталога метаданных.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Как удалить свои данные</h2>
          <p>
            Удалять пока нечего: всё, что у нас есть, — отправленные обращения правообладателей. Их мы храним как
            основание для скрытия материала.
            {email && (
              <>
                {" "}
                Вопрос о своих данных можно задать по адресу{" "}
                <a href={`mailto:${email}`} className={TEXT_LINK}>
                  {email}
                </a>
                .
              </>
            )}
          </p>
        </section>
      </div>
    </article>
  );
}
