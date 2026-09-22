import { AuthDialog, AuthDialogClose } from "@/components/auth/auth-dialog";
import { LoginCard } from "@/components/auth/login-card";

const TITLE_ID = "auth-dialog-title";

/**
 * Перехват /login при клиентском переходе: вход открывается модалкой поверх страницы, с которой
 * нажали «Войти», и адрес этой страницы под модалкой сохраняется. Прямой заход, перезагрузка и
 * браузер без JS попадают на обычную страницу app/login/page.tsx.
 */
export default function LoginModal() {
  return (
    <AuthDialog labelledBy={TITLE_ID}>
      <LoginCard titleId={TITLE_ID} close={<AuthDialogClose />} standaloneLink />
    </AuthDialog>
  );
}
