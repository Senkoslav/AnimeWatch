import Link from "next/link";

import { button, PAGE_TITLE } from "@/components/ui/controls";

// Общая 404 для несуществующих адресов и для тайтлов, которых зритель видеть не должен (черновик, жалоба).
// Текст одинаковый для всех случаев: страница не выдаёт, существует ли скрытый тайтл.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-page space-y-4 px-4 lg:px-8 py-16">
      <h1 className={PAGE_TITLE}>Такой страницы нет</h1>
      <p className="max-w-[70ch] text-muted">Проверьте адрес или найдите тайтл в каталоге.</p>
      <div className="flex flex-wrap gap-4">
        <Link href="/catalog" className={button()}>
          В каталог
        </Link>
        <Link href="/" className={`${button("quiet", "sm")} underline`}>
          На главную
        </Link>
      </div>
    </div>
  );
}
