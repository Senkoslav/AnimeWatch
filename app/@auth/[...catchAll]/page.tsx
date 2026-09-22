/**
 * Клиентский переход по ссылке изнутри модалки (соглашение, политика) не сбрасывает слот сам: модалка
 * осталась бы висеть над новой страницей. Любой другой адрес сводит слот к пустоте
 * (parallel-routes.md, «Closing the modal»).
 */
export default function AuthSlotCatchAll() {
  return null;
}
