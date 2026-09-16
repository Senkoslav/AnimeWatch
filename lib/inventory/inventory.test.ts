import { describe, expect, it } from "vitest";

import { inventoryToCsv, mergeInventory, readInventoryCsv } from "./inventory";
import type { TgVideoPost } from "./tg-export";

function post(messageId: number, caption: string, fileName?: string): TgVideoPost {
  return { chatId: "100", messageId, postedAt: "2024-09-02T21:00:00", caption, fileName, sizeBytes: 3 * 1024 ** 3 };
}

describe("mergeInventory", () => {
  it("повторный прогон по той же выгрузке ничего не меняет", () => {
    const posts = [post(1, "Фрирен 1 серия"), post(2, "Фрирен 2 серия")];
    const first = mergeInventory(posts, []);
    const second = mergeInventory(posts, readInventoryCsv(inventoryToCsv(first.rows)));

    expect(first.added).toBe(2);
    expect(second).toMatchObject({ added: 0, updated: 2, missingFromExport: 0 });
    expect(inventoryToCsv(second.rows)).toBe(inventoryToCsv(first.rows));
  });

  it("сохраняет правки человека и обновляет служебные столбцы", () => {
    const [row] = mergeInventory([post(1, "Фрирен 1 серия")], []).rows;
    if (!row) throw new Error("строка не создана");
    const edited = {
      ...row,
      title: "Провожающая в последний путь Фрирен",
      shikimori_url: "https://shikimori.one/animes/52991",
    };

    const [merged] = mergeInventory([post(1, "Фрирен 1 серия, перезалив")], [edited]).rows;
    expect(merged).toMatchObject({
      title: "Провожающая в последний путь Фрирен",
      shikimori_url: "https://shikimori.one/animes/52991",
      caption: "Фрирен 1 серия, перезалив",
      size_gb: "3.00",
    });
  });

  it("помечает перезаливку той же серии как дубль", () => {
    const { rows } = mergeInventory([post(1, "Фрирен 3 серия"), post(2, "Фрирен 3 серия")], []);
    expect(rows.map((item) => item.review)).toEqual(["дубль: постов с этой серией 2", "дубль: постов с этой серией 2"]);
  });

  it("не теряет строки, которых нет в новой выгрузке", () => {
    const existing = mergeInventory([post(1, "Фрирен 1 серия")], []).rows;
    const result = mergeInventory([post(2, "Фрирен 2 серия")], existing);
    expect(result.rows).toHaveLength(2);
    expect(result.missingFromExport).toBe(1);
  });
});

describe("readInventoryCsv", () => {
  it("не принимает строку без id поста: из неё не создать IngestJob", () => {
    const csv = "title,shikimori_url,episode,tg_chat_id,tg_message_id\nФрирен,,1,100,\n";
    expect(() => readInventoryCsv(csv)).toThrow(/строка 2: пустой tg_chat_id или tg_message_id/);
  });

  it("не принимает незнакомые столбцы", () => {
    expect(() => readInventoryCsv("title,shikimori_url,episode,tg_chat_id,tg_message_id,notes\n")).toThrow(
      /лишние столбцы: notes/,
    );
  });
});
