"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useTransition } from "react";

/** Пауза после последней набранной буквы: запрос на каждую букву — это полный скан `Title` на букву. */
const TYPING_DELAY = 500;

interface CatalogFormProps {
  className?: string;
  children: ReactNode;
}

/**
 * Форма отбора, которая применяется сама: чип, сегмент или год — и выдача уже другая, без
 * «Показать» (решение владельца 2026-09-23). Название применяется паузой в наборе или Enter.
 *
 * Без JS это обычная GET-форма с кнопкой (кнопку показывает `noscript:` в catalog-filters.tsx):
 * docs/04 требует, чтобы фильтры работали без скриптов.
 *
 * Поля неуправляемые и живут между переходами: форма не пересоздаётся, поэтому фокус остаётся на
 * нажатом чипе, а открытый лист на телефоне не закрывается после каждого клика.
 */
export function CatalogForm({ className, children }: CatalogFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Переход начат самой формой: её поля уже показывают новый адрес, трогать их нельзя.
  const own = useRef(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (own.current) return;
    // Адрес сменился снаружи формы: «Сбросить», метка отбора, пресет, «Назад» в истории.
    // Сервер уже прислал новые defaultChecked/defaultValue, reset() переносит их в поля.
    // Поле названия, в котором сейчас печатают, не сбрасываем: иначе съели бы набранное.
    const form = formRef.current;
    const typing = document.activeElement instanceof HTMLInputElement && document.activeElement.type === "search";
    if (form && !(typing && form.contains(document.activeElement))) form.reset();
  }, [searchParams]);

  // Флаг живёт до конца перехода, а не до смены адреса: отбор, который канонически равен
  // текущему, адрес не меняет, и флаг иначе остался бы висеть до следующей чужой навигации.
  useEffect(() => {
    if (!pending) own.current = false;
  }, [pending]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function apply() {
    clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;

    // Пустые поля в адрес не кладём, а жанры пишем по алфавиту на месте первого из них — так же,
    // как catalogHref (compareGenres): иначе каждый клик стоил бы лишнего редиректа на канонический
    // адрес. Отмеченные жанры в разметке стоят первыми, и порядок полей тут не помогает.
    const entries = [...new FormData(form)].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== "",
    );
    const genres = entries
      .filter(([name]) => name === "genre")
      .map(([, value]) => value)
      .sort((a, b) => a.localeCompare(b, "ru"));
    const query = new URLSearchParams();
    for (const [name, value] of entries) {
      if (name !== "genre") query.append(name, value);
      else if (!query.has("genre")) for (const genre of genres) query.append("genre", genre);
    }

    const search = query.toString();
    own.current = true;
    // scroll: false — страница не прыгает вверх под курсором на каждом чипе.
    startTransition(() => router.push((search ? `/catalog?${search}` : "/catalog") as Route, { scroll: false }));
  }

  function onChange(event: ChangeEvent<HTMLFormElement>) {
    // React зовёт onChange текстового поля на каждую букву: его применяем паузой.
    if (event.target instanceof HTMLInputElement && event.target.type === "search") {
      clearTimeout(timer.current);
      timer.current = setTimeout(apply, TYPING_DELAY);
      return;
    }
    apply();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Enter в поле названия: применить сразу, не дожидаясь паузы.
    event.preventDefault();
    apply();
  }

  return (
    <form
      ref={formRef}
      action="/catalog"
      onChange={onChange}
      onSubmit={onSubmit}
      aria-busy={pending || undefined}
      data-pending={pending || undefined}
      className={className}
    >
      {children}
    </form>
  );
}
