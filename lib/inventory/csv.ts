/**
 * CSV по RFC 4180: запятая, поля в кавычках, кавычка экранируется удвоением,
 * переносы строк внутри кавычек. BOM, который добавляет Excel, пропускается.
 */
export function parseCsv(text: string): string[][] {
  const input = text.startsWith("﻿") ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input.charAt(i);
    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (input.charAt(i + 1) === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = false;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input.charAt(i + 1) === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error("CSV: незакрытая кавычка");
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell !== ""));
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return `${rows.map((row) => row.map(escapeField).join(",")).join("\n")}\n`;
}

function escapeField(value: string): string {
  return /[",\r\n]/.test(value) || value !== value.trim() ? `"${value.replaceAll('"', '""')}"` : value;
}
