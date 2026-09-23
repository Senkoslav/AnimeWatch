import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionCookieOptions } from "./session";

vi.mock("@/lib/db", () => ({ prisma: {} }));

describe("атрибуты кук входа", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("на проде кука сессии HttpOnly, Secure и SameSite=Lax на весь сайт", () => {
    vi.stubEnv("NODE_ENV", "production");
    const expires = new Date("2026-10-23T00:00:00Z");
    expect(sessionCookieOptions(expires, true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires,
    });
  });

  it("показная кука читается скриптом, остальное то же", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieOptions(new Date(), false)).toMatchObject({ httpOnly: false, secure: true, sameSite: "lax" });
  });
});
