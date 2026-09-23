"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Закрывает окно при смене адреса. Окно живёт в корневом лэйауте и при клиентском переходе
 * (ссылка на соглашение изнутри окна) не перемонтируется — атрибут `open` ставит браузер, и React
 * его не сбросит. Без JS этот эффект не нужен: там каждый переход — полная загрузка страницы.
 */
export function CloseOnNavigate({ dialogId }: { dialogId: string }) {
  const pathname = usePathname();

  useEffect(() => {
    const dialog = document.getElementById(dialogId);
    if (dialog instanceof HTMLDialogElement && dialog.open) dialog.close();
  }, [pathname, dialogId]);

  return null;
}
