import { describe, expect, it } from "vitest";

import fixture from "../../tests/fixtures/bunny-token-vectors.json" with { type: "json" };
import { signCdnUrl, signedPlaylistUrl } from "./sign";

describe("signCdnUrl", () => {
  it.each(fixture.vectors)("совпадает с эталоном Bunny: $name", (vector) => {
    const url = signCdnUrl({
      hostname: fixture.hostname,
      securityKey: fixture.securityKey,
      expiresAt: fixture.expiresAt,
      path: vector.path,
      tokenPath: "tokenPath" in vector ? vector.tokenPath : undefined,
      tokenInPath: vector.tokenInPath,
    });
    expect(url).toBe(vector.expected);
  });

  it("другой ключ даёт другую подпись", () => {
    const options = { hostname: fixture.hostname, expiresAt: fixture.expiresAt, path: "/abc/", tokenInPath: true };
    expect(signCdnUrl({ ...options, securityKey: "a" })).not.toBe(signCdnUrl({ ...options, securityKey: "b" }));
  });

  it("отказывается подписывать пустым ключом", () => {
    expect(() =>
      signCdnUrl({ hostname: "h", securityKey: "", expiresAt: 1, path: "/abc/", tokenInPath: true }),
    ).toThrow(/пустой ключ/);
  });

  it("требует путь от корня зоны", () => {
    expect(() => signCdnUrl({ hostname: "h", securityKey: "k", expiresAt: 1, path: "abc", tokenInPath: true })).toThrow(
      /начинаться с \//,
    );
  });
});

describe("signedPlaylistUrl", () => {
  it("кладёт токен в путь и подписывает весь каталог видео", () => {
    const url = new URL(
      signedPlaylistUrl({
        hostname: "vz-test.b-cdn.net",
        securityKey: "k",
        videoId: "vid-1",
        expiresAt: 1_700_000_000,
      }),
    );
    const [tokenSegment, ...rest] = url.pathname.slice(1).split("/");

    // Варианты и сегменты HLS запрашиваются относительно плейлиста и наследуют токен только из пути.
    expect(tokenSegment).toMatch(/^bcdn_token=HS256-[\w-]+&token_path=%2Fvid-1%2F&expires=1700000000$/);
    expect(rest.join("/")).toBe("vid-1/playlist.m3u8");
    expect(url.search).toBe("");
  });
});
