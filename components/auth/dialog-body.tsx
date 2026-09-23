"use client";

import type { ReactNode } from "react";

import { useDisplayUser } from "@/components/auth/use-display-user";

interface DialogBodyProps {
  titleId: string;
  close: ReactNode;
  /** Карточка входа — для тех, кто не вошёл. */
  children: ReactNode;
}

/**
 * Содержимое окна: карточка входа, а у вошедшего — честное «вы уже вошли». Вошедший попадает сюда
 * только через «В список»: сами списки — следующая задача роадмапа, и кнопка не должна молчать.
 */
export function DialogBody({ titleId, close, children }: DialogBodyProps) {
  const user = useDisplayUser();
  if (!user) return children;

  return (
    <div className="flex flex-col gap-3 p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <h2 id={titleId} className="min-w-0 flex-1 font-display text-xl leading-tight font-bold tracking-tight">
          Вы вошли как {user.name ?? user.email}
        </h2>
        {close}
      </div>
      <p className="text-base text-muted">
        Списки «смотрю», «запланировано» и свои оценки появятся следующим обновлением — они будут жить в вашем
        аккаунте.
      </p>
    </div>
  );
}
