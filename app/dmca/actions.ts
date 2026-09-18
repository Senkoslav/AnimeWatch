"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { notifyDmca } from "@/lib/dmca/notify";
import { dmcaFormFields, dmcaSchema, FIELD_LIMITS, HONEYPOT_FIELD } from "@/lib/dmca/schema";
import type { DmcaState } from "@/lib/dmca/state";
import { clientIp, hashIp, isOverLimit } from "@/lib/dmca/throttle";

/**
 * Приём обращения правообладателя. Роль тут не проверяется и проверяться не может: обращение присылает
 * посторонний (исключение к правилу из `.claude/rules/server.md`). Вместо роли — zod на входе,
 * поле-ловушка и лимит по хешу адреса.
 */
export async function submitDmca(_state: DmcaState, form: FormData): Promise<DmcaState> {
  const fields = dmcaFormFields(form);
  // Возвращаются только настоящие поля: значение ловушки не должно попасть обратно в форму.
  const values = Object.fromEntries(
    [...Object.keys(FIELD_LIMITS), "consent"].map((name) => [name, fields[name] ?? ""]),
  );

  const parsed = dmcaSchema.safeParse(fields);
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    if (fieldErrors[HONEYPOT_FIELD]) {
      // Боту не сообщаем, что он попался в ловушку, а человеку это сообщение не достанется.
      return { status: "error", message: "Обращение не отправлено. Напишите нам письмом.", values };
    }
    const messages = Object.entries(fieldErrors).flatMap(([field, errors]) =>
      errors?.[0] ? [[field, errors[0]] as const] : [],
    );
    return { status: "error", fieldErrors: Object.fromEntries(messages), values };
  }

  const ipHash = hashIp(clientIp(await headers()));
  if (await isOverLimit(ipHash)) {
    return {
      status: "error",
      message: "С этого адреса уже пришло несколько обращений. Напишите письмом по адресу из раздела ниже.",
      values,
    };
  }

  const { claimantName, claimantEmail, rightsHolder, targetUrl, message } = parsed.data;
  const { id } = await prisma.dmcaRequest.create({
    data: { claimantName, claimantEmail, rightsHolder, targetUrl, message, ipHash },
    select: { id: true },
  });

  // Уведомление вторым шагом: если телеграм недоступен, обращение уже в базе и notifiedAt остаётся null.
  if (await notifyDmca(id, parsed.data)) {
    await prisma.dmcaRequest.update({ where: { id }, data: { notifiedAt: new Date() } });
  }

  return { status: "sent" };
}
