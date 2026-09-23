import type { Metadata } from "next";

import { PAGE_TITLE } from "@/components/ui/controls";
import { DmcaForm } from "@/components/dmca/dmca-form";

export const metadata: Metadata = {
  title: "Обращение правообладателя",
  description: "Форма обращения по правам на материалы сайта AnimeWatch.",
};

// Страница с формой не кешируется: в ответе состояние отправки (docs/02, «Кеширование»).
export const dynamic = "force-dynamic";

export default function DmcaPage() {
  return (
    <div className="mx-auto max-w-page px-4 lg:px-8 py-6 md:py-10">
      <h1 className={PAGE_TITLE}>Обращение правообладателя</h1>

      <div className="mt-6 max-w-[70ch] space-y-4">
        <p>
          AnimeWatch — каталог аниме. Мы не храним видеофайлы: воспроизведение идёт во фрейме сторонних поставщиков, а
          на нашей стороне лежат только описания и ссылки. Если размещённый материал нарушает ваши права, напишите нам
          через эту форму.
        </p>
        <p className="text-muted">
          Обращение приходит нам сразу. По подтверждённому обращению тайтл скрывается целиком — вместе со всеми сериями
          — до выяснения обстоятельств.
        </p>
      </div>

      <DmcaForm />

      <section className="mt-12 max-w-[70ch] space-y-3 border-t border-line pt-6 text-sm text-muted">
        <h2 className="text-base text-text">Если форма не работает</h2>
        <p>
          {/* TODO: контактный адрес — нужен перед запуском (docs/06, открытый вопрос «Контакты и домен»). */}
          Напишите на контактный адрес сайта. Укажите те же сведения: кто вы, чьи права затронуты, ссылку на страницу и
          суть обращения.
        </p>
      </section>
    </div>
  );
}
