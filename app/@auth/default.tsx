/**
 * Слот модалки входа, когда она не открыта: при первом заходе и после перезагрузки. Без этого файла
 * любой адрес, кроме перехваченного /login, отдал бы 404 (parallel-routes.md, «default.js»).
 */
export default function AuthSlotDefault() {
  return null;
}
