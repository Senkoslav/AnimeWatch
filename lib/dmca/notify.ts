/**
 * Уведомление об обращении. Канал — бот в телеграме, а не письмо: почтового провайдера в проекте нет,
 * а телеграм владелец сайта читает и так (решение заказчика 2026-09-18, см. docs/06).
 * Токен бота читается только здесь, в серверном модуле.
 */
import "server-only";

import type { DmcaInput } from "./schema";

/** Дольше заявителю ждать незачем: обращение уже в базе, уведомление можно повторить руками. */
const TIMEOUT_MS = 8_000;

/** Сколько символов описания уходит в телеграм: остальное читается в базе, у сообщения есть предел длины. */
const MESSAGE_PREVIEW = 1_500;

function text(id: string, input: DmcaInput): string {
  return [
    "Обращение по правам (/dmca)",
    `Заявитель: ${input.claimantName} <${input.claimantEmail}>`,
    `Правообладатель: ${input.rightsHolder}`,
    `Страница: ${input.targetUrl}`,
    "",
    input.message.slice(0, MESSAGE_PREVIEW),
    "",
    `id: ${id}`,
  ].join("\n");
}

/** true — уведомление ушло. false — нет, и это уже записано в логе: обращение всё равно принято. */
export async function notifyDmca(id: string, input: DmcaInput): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.DMCA_TG_CHAT;
  if (!token || !chatId) {
    console.error(`dmca: обращение ${id} принято, но уведомление не настроено (TELEGRAM_BOT_TOKEN, DMCA_TG_CHAT)`);
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text(id, input), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // Тело ответа телеграма описывает причину (нет прав в чате, неверный chat_id) и секретов не содержит.
      console.error(`dmca: телеграм отклонил уведомление ${id}: ${response.status} ${await response.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`dmca: уведомление ${id} не ушло`, error);
    return false;
  }
}
