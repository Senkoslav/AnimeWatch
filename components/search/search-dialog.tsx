"use client";

import { Search as SearchIcon, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { TEXT_LINK } from "@/components/ui/controls";
import { type QuickSearchResult, quickSearch } from "@/lib/search/actions";
import { MAX_QUERY_LENGTH, MIN_QUICK_QUERY, normalizeQuery, searchHref } from "@/lib/search/query";
import { KIND_LABELS } from "@/lib/labels";
import { titleHref } from "@/lib/routes";

/** Пауза после последней буквы: запрос на каждую букву — это скан `Title` на каждую букву. */
const TYPING_DELAY = 250;

const TITLE_ID = "search-dialog-title";
const STATUS_ID = "search-dialog-status";

type State = { status: "idle" } | { status: "loading"; query: string } | { status: "done"; result: QuickSearchResult };

/** Куда уже печатают: «/» там — это символ, а не открытие поиска. */
function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Поиск в окне (docs/06, фаза B): лупа, поле в шапке, пункт «Поиск» внизу, Ctrl+K / ⌘K и «/»
 * открывают `<dialog>` поверх страницы с живой выдачей.
 *
 * Прогрессивное улучшение над ссылками: всё, что открывает окно, — обычные `<a href="/search">`
 * с `data-search-open`. Без JS это переход на страницу поиска; с JS перехват щелчка открывает окно.
 * `/search` остаётся страницей для прямых ссылок и поисковиков.
 *
 * Клавиатура: ↓ из поля — в выдачу, ↑↓ по строкам, ↑ с первой — обратно в поле, Enter по строке —
 * тайтл, Enter в поле — все результаты. Esc, крестик и нажатие мимо закрывают окно, фокус
 * возвращается туда, откуда его открыли.
 */
export function SearchDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const router = useRouter();
  const pathname = usePathname();

  // Открытие: перехват ссылок с data-search-open и сочетания клавиш. На уровне документа — ссылки
  // стоят в серверной шапке и нижней панели, и своего JS у них нет.
  useEffect(() => {
    function open(from: Element | null) {
      const element = dialog.current;
      if (!element || element.open) return;
      opener.current = from instanceof HTMLElement ? from : null;
      element.showModal();
      input.current?.focus();
      input.current?.select();
    }

    function onClick(event: MouseEvent) {
      // Открыть в новой вкладке — законное желание: модификаторы и средняя кнопка идут мимо окна.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const trigger = (event.target as Element | null)?.closest?.("[data-search-open]");
      if (!trigger) return;
      event.preventDefault();
      open(trigger);
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      const combo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditable(event.target);
      if (!combo && !slash) return;
      event.preventDefault();
      open(document.activeElement);
    }

    // Подсказка сочетания: в шапке с сервера «Ctrl K», на Mac — «⌘K».
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) {
      for (const hint of document.querySelectorAll("[data-search-kbd]")) hint.textContent = "⌘K";
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // Переход (выбрали тайтл, «Все результаты») закрывает окно: оно живёт в лэйауте и само не уйдёт.
  useEffect(() => {
    if (dialog.current?.open) dialog.current.close();
  }, [pathname]);

  // Живая выдача: пауза в наборе, и только ответ на последний запрос попадает на экран.
  useEffect(() => {
    const normalized = normalizeQuery(query);
    if (normalized.length < MIN_QUICK_QUERY) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setState({ status: "loading", query: normalized });
      quickSearch(normalized)
        .then((result) => {
          if (id === requestId.current) setState({ status: "done", result });
        })
        .catch(() => {
          if (id === requestId.current)
            setState({ status: "done", result: { ok: false, query: normalized, error: "failed" } });
        });
    }, TYPING_DELAY);
    return () => clearTimeout(timer);
  }, [query]);

  function onQueryChange(value: string) {
    setQuery(value);
    // Короткий запрос сразу гасит выдачу: старые строки под одной буквой читались бы как ответ на неё.
    if (normalizeQuery(value).length < MIN_QUICK_QUERY) {
      requestId.current += 1;
      setState({ status: "idle" });
    }
  }

  function onClose() {
    setQuery("");
    setState({ status: "idle" });
    requestId.current += 1;
    // Нативный <dialog> возвращает фокус сам, но не туда, если окно открыли щелчком по ссылке в Safari.
    opener.current?.focus();
  }

  function items(): HTMLElement[] {
    return [...(list.current?.querySelectorAll<HTMLElement>("[data-search-item]") ?? [])];
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const all = items();
    if (all.length === 0) return;
    const index = all.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    if (event.key === "ArrowDown") all[Math.min(index + 1, all.length - 1)]?.focus();
    else if (index <= 0) input.current?.focus();
    else all[index - 1]?.focus();
  }

  const normalized = normalizeQuery(query);
  const result = state.status === "done" ? state.result : null;
  const status =
    state.status === "loading"
      ? "Ищем…"
      : result?.ok
        ? result.titles.length > 0
          ? `Найдено: ${result.titles.length}${result.more ? " и ещё на странице поиска" : ""}`
          : `Ничего не нашлось по «${result.query}»`
        : result && !result.ok
          ? result.error === "limited"
            ? "Слишком много запросов подряд"
            : "Поиск не ответил"
          : "";

  return (
    <dialog
      ref={dialog}
      aria-labelledby={TITLE_ID}
      closedby="any"
      onClose={onClose}
      className={[
        "glass-modal mx-auto mt-[10vh] mb-auto max-h-[80dvh] w-[min(40rem,calc(100%-2rem))] max-w-none overflow-hidden rounded-xl border border-fill-2 p-0 text-text",
        // Телефон: окно во всю ширину сверху — снизу встаёт клавиатура.
        "max-sm:mt-0 max-sm:max-h-dvh max-sm:w-full max-sm:rounded-t-none max-sm:border-t-0",
        "backdrop:bg-bg/70 backdrop:backdrop-blur-[10px]",
        "transition-[opacity,translate] duration-[180ms] ease-out starting:open:-translate-y-2 starting:open:opacity-0",
      ].join(" ")}
    >
      <div onKeyDown={onKeyDown} className="flex max-h-[inherit] flex-col">
        <h2 id={TITLE_ID} className="sr-only">
          Поиск аниме
        </h2>
        <form
          role="search"
          action="/search"
          onSubmit={(event) => {
            event.preventDefault();
            if (normalized) router.push(searchHref(normalized));
          }}
          className="flex items-center gap-2 border-b border-line px-4 py-3"
        >
          <SearchIcon aria-hidden="true" className="size-5 shrink-0 text-dim" />
          <label htmlFor="search-dialog-input" className="sr-only">
            Название аниме
          </label>
          <input
            ref={input}
            id="search-dialog-input"
            name="q"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            maxLength={MAX_QUERY_LENGTH}
            autoComplete="off"
            spellCheck={false}
            placeholder="Название аниме"
            aria-describedby={STATUS_ID}
            // Встроенный крестик очистки Chrome у type="search" спрятан: рядом свой «Закрыть», и два
            // одинаковых значка с разным действием путали бы.
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[1rem] text-text outline-none placeholder:text-dim [&::-webkit-search-cancel-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted hover:bg-fill hover:text-text"
          >
            <span className="sr-only">Закрыть поиск</span>
            <X aria-hidden="true" className="size-4" />
          </button>
        </form>

        {/* Итог словами — для скринридера: выдача меняется без перехода, и её надо озвучить. */}
        <p id={STATUS_ID} role="status" className="sr-only">
          {status}
        </p>

        <div aria-busy={state.status === "loading" || undefined} className="min-h-0 overflow-y-auto">
          {state.status === "idle" && (
            <p className="px-4 py-5 text-sm text-muted">
              Название на русском или оригинальное. Enter — все результаты на странице поиска.
            </p>
          )}

          {state.status === "loading" && <p className="px-4 py-5 text-sm text-dim">Ищем…</p>}

          {result?.ok && result.titles.length > 0 && (
            <ul ref={list} aria-label="Найденные тайтлы" className="py-1.5">
              {result.titles.map((title) => (
                <li key={title.slug}>
                  <Link
                    href={titleHref(title.slug)}
                    data-search-item=""
                    className="flex min-h-15 items-center gap-3.5 px-4 py-2 outline-offset-[-2px] hover:bg-fill focus-visible:bg-fill"
                  >
                    <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-[6px] border border-line bg-surface-2">
                      {title.posterUrl && (
                        <Image src={title.posterUrl} alt="" fill sizes="32px" className="object-cover" />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-base font-medium">{title.nameRu}</span>
                      <span className="text-xs text-dim">
                        {[title.year, KIND_LABELS[title.kind]].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              <li className="mt-1.5 border-t border-line">
                <Link
                  href={searchHref(result.query)}
                  data-search-item=""
                  className="flex min-h-12 items-center px-4 text-sm text-muted outline-offset-[-2px] hover:bg-fill hover:text-text focus-visible:bg-fill"
                >
                  {result.more ? "Все результаты" : "Открыть на странице поиска"} по «{result.query}»
                </Link>
              </li>
            </ul>
          )}

          {result?.ok && result.titles.length === 0 && (
            <p className="px-4 py-5 text-sm text-muted">
              Ничего не нашлось по «{result.query}». Проверьте опечатку или{" "}
              <Link href="/catalog" className={TEXT_LINK}>
                откройте каталог
              </Link>
              .
            </p>
          )}

          {result && !result.ok && (
            <p className="px-4 py-5 text-sm text-muted">
              {result.error === "limited"
                ? "Слишком много запросов подряд. Подождите минуту — или "
                : "Поиск не ответил. Попробуйте ещё раз — или "}
              <Link href={searchHref(result.query)} className={TEXT_LINK}>
                откройте страницу поиска
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
}
