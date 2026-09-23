/**
 * Куда вернуть человека после входа. Берётся из Referer: ссылка «Продолжить с Google» серверная и
 * статическая, и путь страницы, с которой нажали «Войти», без JS иначе не узнать.
 *
 * Принимается только путь нашего же сайта: чужой хост, `//evil.example` и служебные адреса входа
 * превращаются в главную. Иначе вход становился бы открытым редиректом.
 */
export function safeReturnTo(referer: string | null | undefined, origin: string): string {
  if (!referer) return "/";
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    // Не адрес — возвращаем на главную.
    return "/";
  }
  if (url.origin !== origin) return "/";
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return "/";
  return `${url.pathname}${url.search}`;
}

/** Путь возврата из куки: ещё раз проверяем, что это путь, а не адрес на чужой хост. */
export function isLocalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}
