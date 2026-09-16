import { describe, expect, it } from "vitest";

import sample from "../../tests/fixtures/tg-export.sample.json" with { type: "json" };
import { guessEpisode, parseTelegramExport } from "./tg-export";

describe("parseTelegramExport", () => {
  const result = parseTelegramExport(sample);

  it("берёт только файлы серий: без фото, текстовых постов и гифок", () => {
    expect(result.chats).toEqual([{ id: "1987654321", name: "BebraDub Архив", messages: 12, videos: 8 }]);
    expect(result.posts.map((post) => post.messageId)).toEqual([12, 13, 16, 17, 18, 19, 21, 22]);
  });

  it("склеивает подпись из строк и сущностей", () => {
    const post = result.posts.find((item) => item.messageId === 16);
    expect(post).toMatchObject({ chatId: "1987654321", caption: "#Фрирен эпизод №3", fileName: "frieren_03.mp4" });
  });

  it("принимает выгрузку всего аккаунта с chats.list", () => {
    const account = { chats: { list: [sample] } };
    expect(parseTelegramExport(account).posts).toHaveLength(8);
  });

  it("не принимает JSON, который не похож на выгрузку", () => {
    expect(() => parseTelegramExport([])).toThrow(/JSON-объектом/);
    expect(() => parseTelegramExport({ foo: 1 })).toThrow(/не похоже на выгрузку/);
  });
});

describe("guessEpisode", () => {
  it.each([
    ["Провожающая в последний путь Фрирен — 1 серия", undefined, "Провожающая в последний путь Фрирен", 1],
    ["", "[BebraDub] Sousou no Frieren - 02 [2160p].mkv", "Sousou no Frieren", 2],
    ["Фрирен 3 серия (исправленная)\nПерезалили со звуком", "Frieren_S01E03_v2.mkv", "Фрирен", 3],
    ["Реинкарнация безработного 2 — 7 серия 🔥", "Mushoku_Tensei_II_07.mkv", "Реинкарнация безработного 2", 7],
    ["", "Кайдзю 8 - 05.mkv", "Кайдзю 8", 5],
  ])("уверенно: %j / %j", (caption, fileName, title, episode) => {
    expect(guessEpisode(caption, fileName)).toEqual({ title, episode, notes: [] });
  });

  it("помечает для человека догадку по знаку №", () => {
    // «Кайдзю №8» — название, а парсер берёт 8 как номер серии. Строка должна уйти на проверку.
    expect(guessEpisode("Кайдзю №8 6", "ep.mkv").notes).toEqual(["номер серии угадан по знаку # или №"]);
  });

  it("не придумывает номер, если его нет", () => {
    expect(guessEpisode("Трейлер нового сезона", "trailer.mp4")).toEqual({
      title: "Трейлер нового сезона",
      episode: undefined,
      notes: ["номер серии не найден"],
    });
  });
});
