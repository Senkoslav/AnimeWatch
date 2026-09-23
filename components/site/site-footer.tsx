import Link from "next/link";

// Дисклеймер и ссылка на /dmca обязательны (CLAUDE.md, «Контент и право»): не удалять и не прятать.
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-page space-y-4 px-4 lg:px-8 py-8 text-sm text-dim">
        <p className="max-w-[70ch]">
          AnimeWatch — каталог аниме. Видеофайлы мы не храним и не раздаём: воспроизведение идёт во фрейме сторонних
          поставщиков. Права на произведения принадлежат их правообладателям, по обращению правообладателя мы скрываем
          тайтл.
        </p>
        <nav aria-label="Правовая информация" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/dmca" className="inline-flex min-h-11 items-center hover:text-text">
            Обращение правообладателя
          </Link>
          <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-text">
            Соглашение
          </Link>
          <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-text">
            Конфиденциальность
          </Link>
        </nav>
        <p>© {new Date().getFullYear()} AnimeWatch</p>
      </div>
    </footer>
  );
}
