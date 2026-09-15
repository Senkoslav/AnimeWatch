/**
 * pnpm tg:login — вход аккаунтом-воркером и запись TG_SESSION в worker/.env.
 *
 * Запускать самому в своём терминале, не через Claude: сессия даёт полный доступ к
 * аккаунту. Скрипт её не печатает, а сразу пишет в worker/.env, который не попадает
 * в git. В фазе 2 вход лучше повторить на VPS воркера, чтобы сессия жила с его IP.
 */
import { existsSync } from "node:fs";
import { chmod, readFile, writeFile } from "node:fs/promises";

import { ConfigError, loadWorkerEnv, WORKER_ENV_PATH } from "../env.js";
import { createTelegramClient, describeTelegramError, isFloodWait } from "../telegram/client.js";
import { ask, askHidden } from "../terminal.js";

async function main(): Promise<void> {
  loadWorkerEnv();
  if (!process.stdin.isTTY) {
    throw new ConfigError("tg:login интерактивный: запусти его в своём терминале.");
  }

  const { client, session } = createTelegramClient("");
  try {
    await client.start({
      phoneNumber: () => ask("Телефон аккаунта-воркера, в формате +7…: "),
      phoneCode: () => ask("Код из Telegram: "),
      password: (hint) => askHidden(`Пароль двухфакторной защиты${hint ? ` (подсказка: ${hint})` : ""}: `),
      onError: async (error) => {
        console.error(describeTelegramError(error));
        // Неверный код или телефон — спросить заново; на FLOOD_WAIT остановиться.
        return isFloodWait(error);
      },
    });

    await upsertEnvVar(WORKER_ENV_PATH, "TG_SESSION", session.save());
    const me = await client.getMe();
    console.log(`Вход выполнен: ${me.username ? `@${me.username}` : "аккаунт без ника"}. TG_SESSION записан в worker/.env.`);
    console.log("Проверка: pnpm tg:whoami");
  } finally {
    await client.destroy();
  }
}

/** Заменяет или дописывает переменную, не трогая остальные строки файла. */
async function upsertEnvVar(path: string, name: string, value: string): Promise<void> {
  const current = existsSync(path) ? await readFile(path, "utf8") : "";
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  const next = pattern.test(current)
    ? current.replace(pattern, () => line)
    : `${current}${current === "" || current.endsWith("\n") ? "" : "\n"}${line}\n`;
  await writeFile(path, next, { mode: 0o600 });
  await chmod(path, 0o600);
}

main().catch((error: unknown) => {
  console.error(error instanceof ConfigError ? error.message : describeTelegramError(error));
  process.exitCode = 1;
});
