import { describe, expect, it, vi } from "vitest";

import { authorizeUrl, exchangeCode, googleConfig, parseIdToken } from "./google";

const CLIENT_ID = "client.apps.googleusercontent.com";
const NOW = new Date("2026-09-23T12:00:00Z");

function idToken(claims: Record<string, unknown>): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}

const VALID = {
  iss: "https://accounts.google.com",
  aud: CLIENT_ID,
  exp: NOW.getTime() / 1000 + 600,
  sub: "1234567890",
  email: "viewer@example.com",
  email_verified: true,
  name: "Зритель",
  picture: "https://lh3.googleusercontent.com/a/photo",
};

describe("googleConfig", () => {
  it("вход включён, только когда заданы оба ключа", () => {
    expect(googleConfig({ GOOGLE_CLIENT_ID: "id" })).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: " " })).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" })).toEqual({
      clientId: "id",
      clientSecret: "s",
    });
  });
});

describe("authorizeUrl", () => {
  it("ведёт на Google с state, PKCE и адресом возврата на наш callback", () => {
    const url = new URL(authorizeUrl({ clientId: CLIENT_ID, state: "st", challenge: "ch" }));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
      response_type: "code",
      scope: "openid email profile",
    });
    expect(url.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/google\/callback$/);
  });
});

describe("parseIdToken", () => {
  it("достаёт sub, e-mail, имя и аватар", () => {
    expect(parseIdToken(idToken(VALID), CLIENT_ID, NOW)).toEqual({
      googleId: "1234567890",
      email: "viewer@example.com",
      name: "Зритель",
      avatarUrl: "https://lh3.googleusercontent.com/a/photo",
    });
  });

  it("отказывает чужому приложению, чужому издателю, просроченному и неподтверждённому e-mail", () => {
    expect(() => parseIdToken(idToken({ ...VALID, aud: "other" }), CLIENT_ID, NOW)).toThrow(/другому приложению/);
    expect(() => parseIdToken(idToken({ ...VALID, iss: "https://evil.example" }), CLIENT_ID, NOW)).toThrow(
      /издателя/,
    );
    expect(() => parseIdToken(idToken({ ...VALID, exp: NOW.getTime() / 1000 - 1 }), CLIENT_ID, NOW)).toThrow(
      /просрочен/,
    );
    expect(() => parseIdToken(idToken({ ...VALID, email_verified: false }), CLIENT_ID, NOW)).toThrow();
    expect(() => parseIdToken("мусор", CLIENT_ID, NOW)).toThrow();
  });
});

describe("exchangeCode", () => {
  const config = { clientId: CLIENT_ID, clientSecret: "secret" };

  it("меняет код на личность, передавая verifier и секрет только в теле запроса к Google", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ id_token: idToken({ ...VALID, exp: Date.now() / 1000 + 600 }) }),
    );
    const identity = await exchangeCode({ code: "c", verifier: "v", config }, fetchImpl);
    expect(identity.googleId).toBe("1234567890");

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://oauth2.googleapis.com/token");
    const body = new URLSearchParams(String(init?.body));
    expect(body.get("code_verifier")).toBe("v");
    expect(body.get("client_secret")).toBe("secret");
    expect(body.get("grant_type")).toBe("authorization_code");
  });

  it("ошибка Google — исключение с кодом ответа, а не тихий null", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('{"error":"invalid_grant"}', { status: 400 }));
    await expect(exchangeCode({ code: "c", verifier: "v", config }, fetchImpl)).rejects.toThrow(/400.*invalid_grant/);
  });
});
