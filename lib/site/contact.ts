/**
 * Контактный адрес сайта для /dmca, соглашения и политики. Из env, а не строкой в коде: это адрес
 * владельца, и в публичный репозиторий он попадать не должен. Не задан или не похож на адрес —
 * null, и страницы обходятся формой обращения.
 */
import "server-only";

import { z } from "zod";

const emailSchema = z.email();

export function siteContactEmail(): string | null {
  const parsed = emailSchema.safeParse(process.env.CONTACT_EMAIL?.trim());
  return parsed.success ? parsed.data : null;
}
