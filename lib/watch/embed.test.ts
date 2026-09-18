import { describe, expect, it } from "vitest";

import { embedSrc } from "./embed";

describe("embedSrc", () => {
  it("ссылка Kodik без схемы становится https", () => {
    expect(embedSrc("//kodik.info/serial/123/hash/720p?episode=2")).toBe(
      "https://kodik.info/serial/123/hash/720p?episode=2",
    );
  });

  it("разрешены домены Kodik и их поддомены", () => {
    expect(embedSrc("https://kodik.biz/seria/1/x/720p")).toBe("https://kodik.biz/seria/1/x/720p");
    expect(embedSrc("https://cloud.kodik.info/video/1")).toBe("https://cloud.kodik.info/video/1");
  });

  it("чужой хост, http и мусор — не фрейм", () => {
    for (const url of [
      "https://evil.example.com/player",
      "http://kodik.info/serial/1",
      // Проверял руками все обходы, какие придумал: подстановка в путь, запрос и фрагмент,
      // userinfo перед чужим хостом, похожие домены в юникоде и punycode, перевод строки в хосте.
      "https://kodik.info.evil.com/x",
      "https://kodik.info@evil.example.com/x",
      "https://evil.example.com/?next=kodik.info",
      "https://evil.example.com#kodik.info",
      "https://кodik.info/x",
      "https://xn--odik-1of.info/x",
      "https://kodik.info\n.evil.example.com/x",
      "https://aniqit.com.evil.example.com",
      // Пустая метка перед доменом: суффикс совпадает, хоста не существует.
      "https://.kodik.info/x",
      "javascript:alert(1)",
      "data:text/html,<iframe src=//kodik.info>",
      "не ссылка",
      "",
    ]) {
      expect(embedSrc(url), url).toBeNull();
    }
  });
});
