import { describe, expect, it } from "vitest";

import { dmcaFormFields, dmcaSchema, FIELD_LIMITS, HONEYPOT_FIELD } from "./schema";

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    claimantName: "Ирина Правова",
    claimantEmail: "legal@example.com",
    rightsHolder: "ООО «Правообладатель»",
    targetUrl: "https://animewatch.ru/anime/frieren",
    message: "Материал размещён без разрешения, просим скрыть тайтл целиком.",
    consent: "on",
    ...overrides,
  };
  for (const [name, value] of Object.entries(fields)) {
    if (value !== "") data.set(name, value);
  }
  return data;
}

describe("dmcaSchema", () => {
  it("заполненная форма проходит", () => {
    const parsed = dmcaSchema.safeParse(dmcaFormFields(form()));
    expect(parsed.success).toBe(true);
  });

  it("неотмеченный чекбокс и мусор в адресах отклоняются с понятным текстом", () => {
    const cases: [Record<string, string>, string][] = [
      [{ consent: "" }, "consent"],
      [{ claimantEmail: "не почта" }, "claimantEmail"],
      [{ targetUrl: "frieren" }, "targetUrl"],
      [{ claimantName: "" }, "claimantName"],
      [{ message: "коротко" }, "message"],
    ];

    for (const [overrides, field] of cases) {
      const parsed = dmcaSchema.safeParse(dmcaFormFields(form(overrides)));
      expect(parsed.success, field).toBe(false);
      const issue = parsed.error?.issues.find((candidate) => candidate.path[0] === field);
      expect(issue?.message, field).toBeTruthy();
    }
  });

  it("заполненная ловушка не проходит", () => {
    const parsed = dmcaSchema.safeParse(dmcaFormFields(form({ [HONEYPOT_FIELD]: "https://spam.example" })));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.some((issue) => issue.path[0] === HONEYPOT_FIELD)).toBe(true);
  });

  it("пробелы по краям срезаются, слишком длинное поле отклоняется", () => {
    const parsed = dmcaSchema.safeParse(dmcaFormFields(form({ claimantName: "  Ирина  " })));
    expect(parsed.success && parsed.data.claimantName).toBe("Ирина");

    const long = dmcaSchema.safeParse(
      dmcaFormFields(form({ claimantName: "а".repeat(FIELD_LIMITS.claimantName + 1) })),
    );
    expect(long.success).toBe(false);
  });
});

describe("dmcaFormFields", () => {
  it("отсутствующее поле становится пустой строкой: схема даёт свою ошибку вместо падения", () => {
    const fields = dmcaFormFields(new FormData());
    expect(fields).toMatchObject({ claimantName: "", consent: "", [HONEYPOT_FIELD]: "" });
  });
});
