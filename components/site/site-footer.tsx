// Дисклеймер обязателен (CLAUDE.md, «Контент и право»): не удалять и не прятать.
// Ссылку на /dmca добавит задача со страницей обращения.
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-8 text-sm text-muted">
        <p className="max-w-[70ch]">
          BebraDub — любительская студия озвучки. Права на оригинальные произведения принадлежат их правообладателям. По
          обращению правообладателя мы скрываем тайтл.
        </p>
        <p>© {new Date().getFullYear()} BebraDub</p>
      </div>
    </footer>
  );
}
