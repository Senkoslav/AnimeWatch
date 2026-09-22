import type { Metadata } from "next";

import { LoginCard } from "@/components/auth/login-card";

export const metadata: Metadata = {
  title: "Вход",
  // Страница входа в поиске не нужна и плодит дубли с параметрами возврата.
  robots: { index: false, follow: true },
};

/**
 * Прямой заход на /login, перезагрузка и браузер без JS. По клику «Войти» зритель эту страницу не
 * видит: переход перехватывается модалкой (app/@auth/(.)login). Здесь та же карточка в окне.
 *
 * Плотная поверхность, а не стекло: на пустой странице под окном нечего размывать (docs/04).
 */
export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-6xl justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-[30rem] overflow-hidden rounded-xl border border-line bg-surface">
        <LoginCard titleId="login-title" as="h1" />
      </div>
    </div>
  );
}
