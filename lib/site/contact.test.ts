import { afterEach, describe, expect, it, vi } from "vitest";

import { siteContactEmail } from "./contact";

describe("siteContactEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("отдаёт адрес из CONTACT_EMAIL без пробелов по краям", () => {
    vi.stubEnv("CONTACT_EMAIL", "  rights@example.com ");
    expect(siteContactEmail()).toBe("rights@example.com");
  });

  it("пустое или не похожее на адрес значение — null, а не мусор на странице", () => {
    vi.stubEnv("CONTACT_EMAIL", "");
    expect(siteContactEmail()).toBeNull();
    vi.stubEnv("CONTACT_EMAIL", "напишите в телеграм");
    expect(siteContactEmail()).toBeNull();
  });
});
