import { describe, expect, it } from "vitest";

import { countHit, type CounterStore } from "./rate-limit";

function memoryStore() {
  const counts = new Map<string, number>();
  const ttl = new Map<string, number>();
  const store: CounterStore = {
    async incr(key) {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async expire(key, seconds) {
      ttl.set(key, seconds);
      return true;
    },
  };
  return { store, ttl };
}

const RULE = { limit: 3, windowSeconds: 60 };
const NOW = Date.UTC(2026, 8, 24, 12, 0, 30);

describe("countHit", () => {
  it("пропускает до предела и отсекает сверх него", async () => {
    const { store } = memoryStore();
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await countHit(store, "search", "ip", RULE, NOW)).limited);
    expect(results).toEqual([false, false, false, true]);
  });

  it("срок ключу ставит только первое попадание, и он равен окну", async () => {
    const { store, ttl } = memoryStore();
    await countHit(store, "search", "ip", RULE, NOW);
    await countHit(store, "search", "ip", RULE, NOW);
    expect([...ttl.values()]).toEqual([60]);
  });

  it("новое окно — новый счёт; разные адреса и области не мешают друг другу", async () => {
    const { store } = memoryStore();
    for (let i = 0; i < 4; i++) await countHit(store, "search", "ip", RULE, NOW);
    expect((await countHit(store, "search", "ip", RULE, NOW + 60_000)).limited).toBe(false);
    expect((await countHit(store, "search", "other-ip", RULE, NOW)).limited).toBe(false);
    expect((await countHit(store, "comments", "ip", RULE, NOW)).limited).toBe(false);
  });

  it("зависший Redis — исключение по таймауту, а не вечное ожидание", async () => {
    const stuck: CounterStore = { incr: () => new Promise(() => undefined), expire: async () => true };
    await expect(countHit(stuck, "search", "ip", RULE, NOW)).rejects.toThrow(/не ответил/);
  });
});
