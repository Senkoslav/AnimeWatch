/**
 * Состояние формы обращения. Отдельным модулем, потому что файл с `"use server"` вправе
 * экспортировать только асинхронные функции: константа рядом с экшеном роняет страницу целиком.
 */
export type DmcaState =
  | { status: "idle" }
  | { status: "sent" }
  | {
      status: "error";
      /** Общая ошибка: лимит, ловушка, отказ базы. Ошибки конкретных полей — в fieldErrors. */
      message?: string;
      fieldErrors?: Record<string, string>;
      /** Введённое: без этого заявитель перепечатывает всё обращение заново. */
      values: Record<string, string>;
    };

export const initialDmcaState: DmcaState = { status: "idle" };
