/**
 * Адрес фрейма с плеером. Ссылка приходит из базы (её положил импорт или админ), поэтому перед
 * вставкой во фрейм проверяется хост: иначе строка в базе превращается в чужой фрейм на нашей странице.
 */

/** Домены Kodik, с которых приходят их плееры. Новый домен добавляется здесь и нигде больше. */
const ALLOWED_EMBED_HOSTS = ["kodik.info", "kodik.biz", "kodik.cc", "aniqit.com"];

/** Абсолютный https-адрес фрейма или null, если ссылка не с разрешённого домена. */
export function embedSrc(url: string): string | null {
  // Kodik отдаёт ссылки без схемы («//kodik.info/…»): для URL это относительный адрес, дописываем https.
  const candidate = url.startsWith("//") ? `https:${url}` : url;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    // Не адрес вовсе — не повод падать: страница покажет состояние «источник не подключён».
    return null;
  }

  if (parsed.protocol !== "https:") return null;

  const { hostname } = parsed;
  const allowed = ALLOWED_EMBED_HOSTS.some(
    (host) =>
      hostname === host ||
      // Именно поддомен, а не пустая метка: у «.kodik.info» суффикс совпадает, но такого хоста не существует.
      (hostname.endsWith(`.${host}`) && hostname.length > host.length + 1),
  );
  return allowed ? parsed.toString() : null;
}
