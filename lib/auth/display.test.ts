import { describe, expect, it } from "vitest";

import { decodeDisplayUser, encodeDisplayUser, readCookie } from "./display";

describe("показная кука aw_user", () => {
  it("кириллица в имени переживает кодирование", () => {
    const user = { name: "Ярослав", email: "me@example.com", avatarUrl: "https://lh3.googleusercontent.com/a/x=s96-c" };
    expect(decodeDisplayUser(encodeDisplayUser(user))).toEqual(user);
  });

  it("аватар не с googleusercontent отбрасывается, а не ставится на страницу", () => {
    const forged = encodeDisplayUser({ name: "x", email: "x@example.com", avatarUrl: "https://evil.example/pixel.gif" });
    expect(decodeDisplayUser(forged)?.avatarUrl).toBeNull();
    const http = encodeDisplayUser({ name: "x", email: "x@example.com", avatarUrl: "http://lh3.googleusercontent.com/a" });
    expect(decodeDisplayUser(http)?.avatarUrl).toBeNull();
  });

  it("мусор и пустая кука — не вошёл", () => {
    expect(decodeDisplayUser("")).toBeNull();
    expect(decodeDisplayUser("не base64")).toBeNull();
    expect(decodeDisplayUser(btoa("[]"))).toBeNull();
    expect(decodeDisplayUser(btoa('{"n":"x"}'))).toBeNull();
  });

  it("читает свою куку из document.cookie", () => {
    expect(readCookie("a=1; aw_user=abc%3D; b=2", "aw_user")).toBe("abc=");
    expect(readCookie("a=1", "aw_user")).toBeNull();
  });
});
