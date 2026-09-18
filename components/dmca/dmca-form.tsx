"use client";

import { useActionState } from "react";

import { submitDmca } from "@/app/dmca/actions";
import { initialDmcaState } from "@/lib/dmca/state";
import { FIELD_LIMITS, HONEYPOT_FIELD } from "@/lib/dmca/schema";

interface Field {
  name: keyof typeof FIELD_LIMITS;
  label: string;
  hint?: string;
  type?: "email" | "url";
  rows?: number;
}

const FIELDS: Field[] = [
  { name: "claimantName", label: "Ваше имя или организация" },
  { name: "claimantEmail", label: "Адрес для ответа", type: "email", hint: "На него придёт решение по обращению." },
  { name: "rightsHolder", label: "Правообладатель", hint: "Чьи права затронуты." },
  {
    name: "targetUrl",
    label: "Ссылка на страницу",
    type: "url",
    hint: "Адрес страницы этого сайта, где размещён материал.",
  },
  {
    name: "message",
    label: "Суть обращения",
    rows: 6,
    hint: "Что именно нужно скрыть и на каком основании.",
  },
];

const INPUT_CLASS =
  "w-full rounded-sm border border-line bg-surface px-3 py-2 text-base text-text placeholder:text-muted sm:text-sm";

/**
 * Форма обращения. Клиентский компонент только ради ошибок полей без перезагрузки:
 * action передан в <form>, поэтому форма отправляется и с отключённым JS.
 */
export function DmcaForm() {
  const [state, action, pending] = useActionState(submitDmca, initialDmcaState);

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-lg space-y-3 border border-line bg-surface p-4">
        <h2 className="text-lg font-semibold">Обращение принято</h2>
        <p className="max-w-[70ch] text-muted">
          Мы рассмотрим его и ответим на указанный адрес. Если материал нарушает права, тайтл скрывается целиком до
          выяснения.
        </p>
      </div>
    );
  }

  const values = state.status === "error" ? state.values : {};
  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} className="mt-6 max-w-xl space-y-5" noValidate>
      {state.status === "error" && state.message && (
        <p role="alert" className="text-danger">
          {state.message}
        </p>
      )}

      {FIELDS.map((field) => {
        const error = fieldErrors[field.name];
        const errorId = `${field.name}-error`;
        const hintId = `${field.name}-hint`;
        const describedBy = [field.hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

        return (
          <div key={field.name} className="space-y-1.5">
            <label htmlFor={field.name} className="block font-medium">
              {field.label}
            </label>
            {field.hint && (
              <p id={hintId} className="text-sm text-muted">
                {field.hint}
              </p>
            )}
            {field.rows ? (
              <textarea
                id={field.name}
                name={field.name}
                rows={field.rows}
                maxLength={FIELD_LIMITS[field.name]}
                defaultValue={values[field.name] ?? ""}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy || undefined}
                className={INPUT_CLASS}
              />
            ) : (
              <input
                id={field.name}
                name={field.name}
                type={field.type ?? "text"}
                maxLength={FIELD_LIMITS[field.name]}
                defaultValue={values[field.name] ?? ""}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy || undefined}
                className={`h-11 ${INPUT_CLASS}`}
              />
            )}
            {error && (
              <p id={errorId} className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        );
      })}

      <div className="space-y-1.5">
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            name="consent"
            defaultChecked={values.consent === "on"}
            aria-invalid={fieldErrors.consent ? true : undefined}
            aria-describedby={fieldErrors.consent ? "consent-error" : undefined}
            className="mt-0.5 size-5 accent-signal"
          />
          <span>Подтверждаю, что сведения достоверны и я вправе подать это обращение.</span>
        </label>
        {fieldErrors.consent && (
          <p id="consent-error" className="text-sm text-danger">
            {fieldErrors.consent}
          </p>
        )}
      </div>

      {/* Ловушка для ботов: людям и скринридерам не видна, автозаполнение отключено. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor={HONEYPOT_FIELD}>Сайт</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-sm bg-text px-5 font-medium text-bg hover:bg-muted disabled:opacity-60"
      >
        {pending ? "Отправляем" : "Отправить обращение"}
      </button>
    </form>
  );
}
