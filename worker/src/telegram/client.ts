/**
 * MTProto-клиент (GramJS) аккаунта-воркера. Не Bot API: боту доступны файлы только до 20 МБ.
 *
 * Скрипты воркера запускаются с --no-experimental-webstorage: GramJS трогает глобальный
 * localStorage, и Node 25 печатает на это невнятное предупреждение.
 */
import { errors, TelegramClient } from "telegram";
import { Logger, LogLevel } from "telegram/extensions/Logger.js";
import { StringSession } from "telegram/sessions/index.js";

import { ConfigError, requireEnv } from "../env.js";

const API_HINT = "Получи api_id и api_hash на my.telegram.org под аккаунтом-воркером.";
const CONNECTION_RETRIES = 5;

export interface WorkerTelegram {
  client: TelegramClient;
  /** Та же сессия, что внутри клиента; после входа её save() отдаёт строку для TG_SESSION. */
  session: StringSession;
}

/** Пустая строка сессии — новый вход, иначе — сохранённая сессия из TG_SESSION. */
export function createTelegramClient(sessionString: string): WorkerTelegram {
  const apiId = Number(requireEnv("TG_API_ID", API_HINT));
  if (!Number.isInteger(apiId) || apiId <= 0) {
    throw new ConfigError(`TG_API_ID должен быть целым числом. ${API_HINT}`);
  }
  const apiHash = requireEnv("TG_API_HASH", API_HINT);

  let session: StringSession;
  try {
    session = new StringSession(sessionString);
  } catch (error) {
    throw new ConfigError("TG_SESSION повреждён: запусти pnpm tg:login заново.", { cause: error });
  }

  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: CONNECTION_RETRIES,
    // По умолчанию GramJS пишет в консоль каждое подключение и переподключение.
    baseLogger: new Logger(LogLevel.ERROR),
  });
  return { client, session };
}

/** Сетевая операция с потолком по времени: зависшее соединение не должно вешать скрипт. */
export async function withTimeout<T>(operation: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Telegram не ответил за ${ms / 1000} с: ${what}`)), ms);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function isFloodWait(error: unknown): error is errors.FloodWaitError {
  return error instanceof errors.FloodWaitError;
}

/** Текст ошибки для человека. FLOOD_WAIT — не поломка, а просьба подождать. */
export function describeTelegramError(error: unknown): string {
  if (isFloodWait(error)) {
    return `Telegram просит подождать ${error.seconds} с (FLOOD_WAIT). Повтори позже, не чаще.`;
  }
  if (error instanceof errors.RPCError) {
    return `Telegram ответил ошибкой ${error.errorMessage}`;
  }
  return error instanceof Error ? error.message : String(error);
}
