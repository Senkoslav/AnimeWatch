/**
 * Ввод в терминале для интерактивных скриптов воркера.
 */
import { createInterface } from "node:readline/promises";

export async function ask(prompt: string): Promise<string> {
  // Отдельный readline на каждый вопрос: открытый readline эхом повторил бы ввод пароля.
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await readline.question(prompt)).trim();
  } finally {
    readline.close();
  }
}

/** Ввод без эха: пароль не должен остаться в истории терминала. */
export async function askHidden(prompt: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    throw new Error("скрытый ввод работает только в интерактивном терминале");
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.setEncoding("utf8");
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (result: () => void) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      result();
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish(() => resolve(value));
          return;
        }
        if (char === "") {
          finish(() => reject(new Error("ввод прерван")));
          return;
        }
        value = char === "" || char === "\b" ? value.slice(0, -1) : value + char;
      }
    };
    stdin.on("data", onData);
  });
}
