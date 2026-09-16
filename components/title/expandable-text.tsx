"use client";

import { useId, useState } from "react";

interface ExpandableTextProps {
  text: string;
  /** Показывать ли «Ещё». Сервер решает по длине: короткое описание обрезать нечего. */
  collapsible: boolean;
}

/**
 * Описание в 3 строки с «Ещё». В HTML всегда полный текст: обрезка только визуальная (line-clamp),
 * поэтому поисковик и зритель без JS видят описание целиком.
 */
export function ExpandableText({ text, collapsible }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const clamped = collapsible && !expanded;

  return (
    <div className="max-w-[70ch]">
      <p id={id} className={`whitespace-pre-line ${clamped ? "line-clamp-3" : ""}`}>
        {text}
      </p>
      {collapsible && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className="-mx-2 mt-1 inline-flex min-h-11 items-center rounded-sm px-2 text-sm text-muted underline hover:text-text"
        >
          {expanded ? "Свернуть" : "Ещё"}
        </button>
      )}
    </div>
  );
}
