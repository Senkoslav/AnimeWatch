/**
 * pnpm data:inventory <result.json…> [--out <путь>]
 *
 * Собирает черновик data/inventory.csv из выгрузки истории канала Telegram Desktop:
 * канал → ⋮ → «Экспорт истории чата», формат JSON, медиа выключены. Посты с
 * видеофайлами становятся строками, тайтл и номер серии угадываются по подписи и
 * имени файла, сомнительные догадки получают пометку в review.
 *
 * Повторный прогон правки не затирает: у известных постов сохраняются title,
 * shikimori_url, episode и review, обновляются служебные столбцы, новые посты
 * дописываются в конец сортировки.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import {
  inventoryToCsv,
  mergeInventory,
  readInventoryCsv,
  type InventoryRow,
  type MergeResult,
} from "../lib/inventory/inventory";
import { parseTelegramExport, type TgVideoPost } from "../lib/inventory/tg-export";

const DEFAULT_OUT = "data/inventory.csv";

async function main(): Promise<void> {
  // pnpm запускает скрипт из корня проекта, а пути пользователь даёт от своей папки.
  const cwd = process.env.INIT_CWD ?? process.cwd();
  const args = process.argv.slice(2);
  const files: string[] = [];
  let out = resolve(DEFAULT_OUT);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? "";
    if (arg === "--out") {
      const value = args[i + 1];
      if (!value) throw new Error("после --out нужен путь к CSV");
      out = resolve(cwd, value);
      i += 1;
    } else if (arg.startsWith("--")) {
      throw new Error(`неизвестный флаг ${arg}`);
    } else {
      files.push(resolve(cwd, arg));
    }
  }

  if (files.length === 0) {
    console.error("Использование: pnpm data:inventory <result.json…> [--out <путь>]");
    process.exitCode = 1;
    return;
  }

  const posts: TgVideoPost[] = [];
  for (const file of files) {
    let data: unknown;
    try {
      data = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      throw new Error(`${relative(cwd, file)}: не удалось прочитать JSON`, { cause: error });
    }
    const parsed = parseTelegramExport(data);
    for (const chat of parsed.chats) {
      console.log(`«${chat.name}», id ${chat.id}: постов с видео ${chat.videos} из ${chat.messages} сообщений`);
    }
    posts.push(...parsed.posts);
  }

  let result: MergeResult;
  try {
    const existing: InventoryRow[] = existsSync(out) ? readInventoryCsv(await readFile(out, "utf8")) : [];
    result = mergeInventory(posts, existing);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${relative(cwd, out)}: ${reason}`, { cause: error });
  }

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, inventoryToCsv(result.rows));

  const toReview = result.rows.filter((row) => row.review !== "").length;
  console.log(
    `${relative(cwd, out)}: строк ${result.rows.length}; новых ${result.added}, обновлено ${result.updated}, ` +
      `нет в выгрузке ${result.missingFromExport}. С пометкой в review: ${toReview}.`,
  );
  console.log(
    "Дальше: заполни shikimori_url, поправь title и episode, очисти review у проверенных строк. " +
      "Строки не удаляй: чтобы пропустить пост, впиши в review «пропустить».",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
