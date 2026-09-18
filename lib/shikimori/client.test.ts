import { describe, expect, it } from "vitest";

import { createShikimoriClient, MAX_PAGE_SIZE } from "./client";

/** Часы, которые двигает только сон: тест не ждёт по-настоящему. */
function fakeClock() {
  let current = 0;
  const waits: number[] = [];
  return {
    now: () => current,
    sleep: async (ms: number) => {
      waits.push(ms);
      current += ms;
    },
    waits,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

function okAnimes(ids: number[] = [16498]) {
  return jsonResponse({
    data: {
      animes: ids.map((id) => ({
        id: String(id),
        name: `Anime ${id}`,
        kind: "tv",
        status: "released",
        episodes: 12,
        episodesAired: 0,
      })),
    },
  });
}

describe("частота запросов", () => {
  it("четыре запроса в секунду проходят без ожидания, пятый ждёт", async () => {
    const clock = fakeClock();
    const client = createShikimoriClient({ fetch: async () => okAnimes(), ...clock });

    for (let i = 0; i < 4; i += 1) await client.animes({ limit: 1 });
    expect(clock.waits).toEqual([]);

    await client.animes({ limit: 1 });
    expect(clock.waits.length).toBeGreaterThan(0);
    expect(clock.waits.reduce((sum, wait) => sum + wait, 0)).toBeGreaterThanOrEqual(1_000);
  });

  it("минутный лимит держится: 81 запрос не укладывается в минуту", async () => {
    const clock = fakeClock();
    const client = createShikimoriClient({ fetch: async () => okAnimes(), ...clock });

    for (let i = 0; i < 81; i += 1) await client.animes({ limit: 1 });

    // 80 запросов за минуту — их предел 90, так что в минуту мы не упираемся раньше времени.
    expect(clock.now()).toBeGreaterThanOrEqual(20_000);
    expect(clock.now()).toBeLessThan(120_000);
  });
});

describe("повторы", () => {
  it("429 с Retry-After: ждёт указанное время и повторяет", async () => {
    const clock = fakeClock();
    const responses = [new Response("", { status: 429, headers: { "retry-after": "3" } }), okAnimes()];
    const messages: string[] = [];
    const client = createShikimoriClient({
      fetch: async () => responses.shift() ?? okAnimes(),
      onRetry: (message) => messages.push(message),
      ...clock,
    });

    const animes = await client.animes({ limit: 1 });
    expect(animes).toHaveLength(1);
    expect(clock.waits).toContain(3_000);
    expect(messages[0]).toContain("429");
  });

  it("пятисотка повторяется с растущей паузой, после трёх попыток — ошибка", async () => {
    const clock = fakeClock();
    let calls = 0;
    const client = createShikimoriClient({
      fetch: async () => {
        calls += 1;
        return new Response("", { status: 502, statusText: "Bad Gateway" });
      },
      ...clock,
    });

    await expect(client.animes({ limit: 1 })).rejects.toThrow("502");
    expect(calls).toBe(3);
    expect(clock.waits).toEqual([1_000, 2_000]);
  });

  it("400 не повторяется: повтором такое не лечится", async () => {
    let calls = 0;
    const clock = fakeClock();
    const client = createShikimoriClient({
      fetch: async () => {
        calls += 1;
        return new Response("", { status: 400, statusText: "Bad Request" });
      },
      ...clock,
    });

    await expect(client.animes({ limit: 1 })).rejects.toThrow("400");
    expect(calls).toBe(1);
  });
});

describe("разбор ответа", () => {
  it("ошибка в теле ответа поднимается, а не проглатывается", async () => {
    const clock = fakeClock();
    const client = createShikimoriClient({
      fetch: async () => jsonResponse({ errors: [{ message: "Field 'nope' doesn't exist" }] }),
      ...clock,
    });

    await expect(client.animes({ limit: 1 })).rejects.toThrow("Field 'nope' doesn't exist");
  });

  it("один сломанный тайтл не роняет остальные", async () => {
    const clock = fakeClock();
    const client = createShikimoriClient({
      fetch: async () =>
        jsonResponse({
          data: {
            animes: [
              { id: "не число", name: "Сломанный" },
              { id: "16498", name: "Shingeki no Kyojin", kind: "tv", status: "released" },
            ],
          },
        }),
      ...clock,
    });

    const animes = await client.animes({ limit: 2 });
    expect(animes.map((anime) => anime.id)).toEqual([16498]);
  });

  it("limit ограничен их пределом, ids уходят строкой через запятую", async () => {
    const clock = fakeClock();
    let body: { variables: Record<string, unknown> } | undefined;
    const client = createShikimoriClient({
      fetch: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return okAnimes();
      },
      ...clock,
    });

    await client.animes({ limit: 500, ids: [21, 16498] });
    expect(body?.variables.limit).toBe(MAX_PAGE_SIZE);
    expect(body?.variables.ids).toBe("21,16498");
  });
});
