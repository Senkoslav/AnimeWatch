// Заглушка до задачи «Главная» из фазы 3: проверяет шрифты и токены, ничего больше.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-4 px-4">
      <h1 className="font-display text-2xl font-bold">BebraDub</h1>
      <p className="max-w-[70ch] text-muted">Сайт студии собирается. Новые серии пока выходят в телеграм-канале.</p>
    </main>
  );
}
