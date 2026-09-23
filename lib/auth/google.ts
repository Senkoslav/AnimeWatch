/**
 * Вход через Google: OAuth 2.0 code flow с PKCE, своими руками (docs/02, «Вход»). Секрет и обмен
 * кода — только здесь, на сервере.
 */
import "server-only";

import { z } from "zod";

import { siteUrl } from "@/lib/site/url";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
/** Google отвечает за доли секунды; дольше — значит, что-то сломано, и человек не должен ждать вечно. */
const TOKEN_TIMEOUT_MS = 10_000;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

/** Ключи из env. Нет хотя бы одного — входа нет, и окно честно об этом говорит. */
export function googleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * Адрес возврата от Google. От адреса сайта, а не от запроса: он обязан буква в букву совпасть с
 * зарегистрированным в Google Cloud. Поэтому на превью Vercel вход не работает — их адрес не
 * зарегистрирован, а canonical и callback ведут на прод.
 */
export function callbackUrl(): string {
  return new URL("/api/auth/google/callback", siteUrl()).href;
}

export function authorizeUrl({
  clientId,
  state,
  challenge,
}: {
  clientId: string;
  state: string;
  challenge: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    // Выбор аккаунта каждый раз: иначе после выхода Google молча входил бы в тот же.
    prompt: "select_account",
  }).toString();
  return url.href;
}

export interface GoogleIdentity {
  googleId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

const tokenResponseSchema = z.object({ id_token: z.string().min(1) });

const claimsSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.literal(true),
  name: z.string().optional(),
  picture: z.url().optional(),
});

/**
 * Разбор id_token. Подпись не проверяется: токен получен напрямую с token endpoint Google по TLS,
 * и OpenID Connect Core 3.1.3.7 разрешает в этом случае полагаться на TLS. Поэтому и библиотеки JWT
 * в проекте нет. Проверяются издатель, адресат (наш client id), срок и подтверждённый e-mail.
 */
export function parseIdToken(idToken: string, clientId: string, now: Date = new Date()): GoogleIdentity {
  const [, payload] = idToken.split(".");
  if (!payload) throw new Error("id_token без полезной нагрузки");
  const claims = claimsSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  if (!ISSUERS.includes(claims.iss)) throw new Error(`id_token от чужого издателя: ${claims.iss}`);
  if (claims.aud !== clientId) throw new Error("id_token выдан другому приложению");
  if (claims.exp * 1000 <= now.getTime()) throw new Error("id_token просрочен");
  return {
    googleId: claims.sub,
    email: claims.email,
    name: claims.name?.trim() || null,
    avatarUrl: claims.picture ?? null,
  };
}

/** Обмен кода на id_token. Любой сбой — исключение с понятным текстом; маршрут его логирует. */
export async function exchangeCode(
  { code, verifier, config }: { code: string; verifier: string; config: GoogleConfig },
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleIdentity> {
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: callbackUrl(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  if (!response.ok) {
    // Тело ответа Google с описанием ошибки полезно в логе; токенов в ответе с ошибкой нет.
    throw new Error(`Google token endpoint ответил ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const { id_token } = tokenResponseSchema.parse(await response.json());
  return parseIdToken(id_token, config.clientId);
}
