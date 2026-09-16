import Link from "next/link";

// Общая 404 для несуществующих адресов и для тайтлов, которых зритель видеть не должен (черновик, жалоба).
// Текст одинаковый для всех случаев: страница не выдаёт, существует ли скрытый тайтл.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-16">
      <h1 className="text-xl font-semibold">Такой страницы нет</h1>
      <p className="max-w-[70ch] text-muted">Проверьте адрес или найдите тайтл в каталоге.</p>
      <div className="flex flex-wrap gap-4">
        <Link
          href="/catalog"
          className="inline-flex min-h-11 items-center rounded-sm bg-text px-5 font-medium text-bg hover:bg-muted"
        >
          В каталог
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-sm px-2 underline">
          На главную
        </Link>
      </div>
    </div>
  );
}
