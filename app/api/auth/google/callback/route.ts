import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { encodeDisplayUser, OAUTH_COOKIE, SESSION_COOKIE, USER_COOKIE } from "@/lib/auth/display";
import { exchangeCode, googleConfig } from "@/lib/auth/google";
import { isLocalPath } from "@/lib/auth/return-to";
import { createSession, sessionCookieOptions, upsertGoogleUser } from "@/lib/auth/session";
import { safeEqual } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

const oauthCookieSchema = z.object({
  state: z.string().min(1),
  verifier: z.string().min(1),
  returnTo: z.string().refine(isLocalPath),
});

const callbackSchema = z.object({ code: z.string().min(1).max(2048), state: z.string().min(1).max(256) });

type Reason = "denied" | "state" | "google" | "unavailable";

function fail(request: NextRequest, reason: Reason) {
  const response = NextResponse.redirect(new URL(`/auth/error?reason=${reason}`, request.url));
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
  return response;
}

function readOauthCookie(value: string | undefined) {
  if (!value) return null;
  try {
    const parsed = oauthCookieSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    // Кука не JSON — чужая или битая; для входа это то же, что её отсутствие.
    return null;
  }
}

/**
 * Возврат от Google. Всё, что пришло в адресе, — внешний вход: state сверяется с кукой, код
 * меняется на личность только на сервере (lib/auth/google.ts). Итог — сессия и две куки: httpOnly
 * с токеном и показная для шапки (lib/auth/display.ts).
 */
export async function GET(request: NextRequest) {
  const config = googleConfig();
  if (!config) return fail(request, "unavailable");

  const query = Object.fromEntries(request.nextUrl.searchParams);
  // Человек нажал «Отмена» на странице Google — это не ошибка сайта, и страница скажет это иначе.
  if (query.error === "access_denied") return fail(request, "denied");

  const saved = readOauthCookie(request.cookies.get(OAUTH_COOKIE)?.value);
  const params = callbackSchema.safeParse(query);
  if (!saved || !params.success || !safeEqual(params.data.state, saved.state)) return fail(request, "state");

  try {
    const identity = await exchangeCode({ code: params.data.code, verifier: saved.verifier, config });
    const user = await upsertGoogleUser(identity);
    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.redirect(new URL(saved.returnTo, request.url));
    response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt, true));
    response.cookies.set(USER_COOKIE, encodeDisplayUser(user), sessionCookieOptions(expiresAt, false));
    return response;
  } catch (error) {
    // Контекст без токенов и кода: только что сломалось.
    console.error("[auth] вход через Google не удался:", error instanceof Error ? error.message : error);
    return fail(request, "google");
  }
}
