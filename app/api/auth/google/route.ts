import { type NextRequest, NextResponse } from "next/server";

import { OAUTH_COOKIE } from "@/lib/auth/display";
import { authorizeUrl, googleConfig } from "@/lib/auth/google";
import { safeReturnTo } from "@/lib/auth/return-to";
import { pkceChallenge, randomToken } from "@/lib/auth/tokens";

/** На каждый вход свои state и verifier: кешировать здесь нечего. */
export const dynamic = "force-dynamic";

/** Сколько живёт незаконченный вход: человек выбирает аккаунт в Google, дольше это не длится. */
const OAUTH_TTL_S = 10 * 60;

/**
 * «Продолжить с Google»: уход на страницу Google. state защищает возврат от подмены, PKCE —
 * перехваченный код от обмена чужими руками. Оба и адрес возврата лежат в короткой httpOnly-куке,
 * видной только маршрутам /api/auth.
 */
export function GET(request: NextRequest) {
  const config = googleConfig();
  if (!config) return NextResponse.redirect(new URL("/auth/error?reason=unavailable", request.url));

  const state = randomToken();
  const verifier = randomToken();
  const returnTo = safeReturnTo(request.headers.get("referer"), request.nextUrl.origin);

  const response = NextResponse.redirect(
    authorizeUrl({ clientId: config.clientId, state, challenge: pkceChallenge(verifier) }),
  );
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, verifier, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
    maxAge: OAUTH_TTL_S,
  });
  return response;
}
