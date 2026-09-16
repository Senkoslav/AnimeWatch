import { describe, expect, it } from "vitest";

import { parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("разбирает кавычки, запятые и переносы внутри поля", () => {
    const text = 'title,caption\n"Фрирен, часть 2","первая строка\nвторая ""в кавычках"""\n';
    expect(parseCsv(text)).toEqual([
      ["title", "caption"],
      ["Фрирен, часть 2", 'первая строка\nвторая "в кавычках"'],
    ]);
  });

  it("пропускает BOM от Excel, CRLF и пустые строки", () => {
    expect(parseCsv("﻿a,b\r\n\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("читает последнюю строку без перевода строки в конце", () => {
    expect(parseCsv("a,b\n1,")).toEqual([
      ["a", "b"],
      ["1", ""],
    ]);
  });

  it("падает на незакрытой кавычке, а не теряет данные молча", () => {
    expect(() => parseCsv('a,"b\n1,2')).toThrow(/незакрытая кавычка/);
  });
});

describe("toCsv", () => {
  it("parseCsv читает обратно ровно то, что записал toCsv", () => {
    const rows = [
      ["title", "caption", "review"],
      ["Кайдзю №8", 'серия "6"', ""],
      [" пробел по краям ", "строка\nдругая", "дубль, проверить"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
