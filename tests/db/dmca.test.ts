import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { clientIp, hashIp, isOverLimit, MAX_REQUESTS_PER_HOUR } from "@/lib/dmca/throttle";

const HOUR = 60 * 60 * 1000;

async function createRequests(ipHash: string, count: number, createdAt = new Date()) {
  for (let i = 0; i < count; i += 1) {
    await prisma.dmcaRequest.create({
      data: {
        claimantName: "Заявитель",
        claimantEmail: "legal@example.com",
        rightsHolder: "Правообладатель",
        targetUrl: "https://animewatch.ru/anime/frieren",
        message: "Просим скрыть тайтл",
        ipHash,
        createdAt,
      },
    });
  }
}

describe("лимит обращений", () => {
  it("до предела пропускает, на пределе отклоняет", async () => {
    const ipHash = hashIp("203.0.113.10");
    await createRequests(ipHash, MAX_REQUESTS_PER_HOUR - 1);
    expect(await isOverLimit(ipHash)).toBe(false);

    await createRequests(ipHash, 1);
    expect(await isOverLimit(ipHash)).toBe(true);
  });

  it("считает только последний час", async () => {
    const ipHash = hashIp("203.0.113.11");
    await createRequests(ipHash, MAX_REQUESTS_PER_HOUR, new Date(Date.now() - 2 * HOUR));

    expect(await isOverLimit(ipHash)).toBe(false);
  });

  it("лимит одного адреса не закрывает форму остальным", async () => {
    const blocked = hashIp("203.0.113.12");
    await createRequests(blocked, MAX_REQUESTS_PER_HOUR);

    expect(await isOverLimit(blocked)).toBe(true);
    expect(await isOverLimit(hashIp("203.0.113.13"))).toBe(false);
  });
});

describe("hashIp", () => {
  it("адрес в базу не попадает: только хеш, одинаковый для одного адреса", () => {
    const hash = hashIp("203.0.113.10");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashIp("203.0.113.10"));
    expect(hash).not.toBe(hashIp("203.0.113.11"));
    expect(hash).not.toContain("203.0.113.10");
  });
});

describe("clientIp", () => {
  it("за прокси берётся первый адрес из x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.10, 70.41.3.18" }))).toBe("203.0.113.10");
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.20" }))).toBe("203.0.113.20");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
