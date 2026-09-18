/**
 * Внешний вход формы обращения: разбирается zod на границе (`.claude/rules/server.md`).
 * Тексты ошибок — то, что увидит заявитель, поэтому говорят, что не так и что сделать.
 */
import { z } from "zod";

export const FIELD_LIMITS = {
  claimantName: 120,
  claimantEmail: 200,
  rightsHolder: 200,
  targetUrl: 500,
  message: 4000,
} as const;

/** Имя поля-ловушки: настоящий человек его не видит и не заполняет, бот заполняет всё подряд. */
export const HONEYPOT_FIELD = "website";

export const dmcaSchema = z.object({
  claimantName: z
    .string()
    .trim()
    .min(2, "Укажите имя или название организации")
    .max(FIELD_LIMITS.claimantName, "Слишком длинное имя"),
  claimantEmail: z
    .string()
    .trim()
    .max(FIELD_LIMITS.claimantEmail, "Слишком длинный адрес")
    .pipe(z.email("Проверьте адрес: на него придёт наш ответ")),
  rightsHolder: z
    .string()
    .trim()
    .min(2, "Укажите, чьи права затронуты")
    .max(FIELD_LIMITS.rightsHolder, "Слишком длинное название"),
  targetUrl: z
    .string()
    .trim()
    .max(FIELD_LIMITS.targetUrl, "Слишком длинная ссылка")
    .pipe(z.url("Дайте ссылку на страницу этого сайта, например https://animewatch.ru/anime/frieren")),
  message: z
    .string()
    .trim()
    .min(20, "Опишите обращение подробнее: что и на каком основании нужно скрыть")
    .max(FIELD_LIMITS.message, "Слишком длинное описание, вложите подробности в письмо по ответному адресу"),
  // Чекбокс приходит только когда отмечен, поэтому «не отмечен» — это отсутствие поля.
  consent: z.literal("on", { error: "Подтвердите, что сведения достоверны" }),
  [HONEYPOT_FIELD]: z.literal("", { error: "Обращение не отправлено" }),
});

export type DmcaInput = z.output<typeof dmcaSchema>;

/** Поля формы из FormData: отсутствующие поля становятся пустой строкой, чтобы схема дала свою ошибку. */
export function dmcaFormFields(form: FormData): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const name of [...Object.keys(FIELD_LIMITS), "consent", HONEYPOT_FIELD]) {
    const value = form.get(name);
    fields[name] = typeof value === "string" ? value : "";
  }
  return fields;
}
