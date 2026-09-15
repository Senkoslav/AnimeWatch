/**
 * Env воркера. Секреты телеграма лежат в worker/.env и живут только в процессе
 * воркера: в Next.js и тем более в клиентский бандл они не передаются.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const WORKER_ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));

/** Ошибка настройки: печатается без стека, её исправляют правкой worker/.env. */
export class ConfigError extends Error {}

export function loadWorkerEnv(): void {
  if (existsSync(WORKER_ENV_PATH)) {
    process.loadEnvFile(WORKER_ENV_PATH);
  }
}

export function requireEnv(name: string, hint: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConfigError(`Не задан ${name} в worker/.env. ${hint}`);
  }
  return value;
}
