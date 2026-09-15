/**
 * pnpm tg:whoami — приёмка задачи «аккаунт-воркер»: печатает ник, статус Premium и
 * роль в архивном канале из TG_ARCHIVE_CHAT. Секретов не выводит.
 */
import { Api, type TelegramClient } from "telegram";

import { ConfigError, loadWorkerEnv, requireEnv } from "../env.js";
import { createTelegramClient, describeTelegramError, withTimeout } from "../telegram/client.js";

const NETWORK_TIMEOUT_MS = 30_000;

/** Права админа канала, которые воркеру не нужны: ему достаточно читать и скачивать. */
const ADMIN_RIGHTS = [
  ["changeInfo", "менять профиль канала"],
  ["postMessages", "публиковать"],
  ["editMessages", "редактировать чужие посты"],
  ["deleteMessages", "удалять посты"],
  ["inviteUsers", "приглашать"],
  ["pinMessages", "закреплять"],
  ["addAdmins", "назначать админов"],
  ["manageCall", "управлять трансляциями"],
  ["postStories", "публиковать истории"],
  ["editStories", "редактировать истории"],
  ["deleteStories", "удалять истории"],
] as const satisfies readonly (readonly [keyof Api.ChatAdminRights, string])[];

async function main(): Promise<void> {
  loadWorkerEnv();
  const { client } = createTelegramClient(requireEnv("TG_SESSION", "Запусти pnpm tg:login в своём терминале."));

  try {
    await withTimeout(client.connect(), NETWORK_TIMEOUT_MS, "подключение");
    if (!(await withTimeout(client.checkAuthorization(), NETWORK_TIMEOUT_MS, "проверка сессии"))) {
      throw new ConfigError("Сессия из TG_SESSION больше не действует: запусти pnpm tg:login заново.");
    }

    const me = await withTimeout(client.getMe(), NETWORK_TIMEOUT_MS, "профиль");
    console.log(me.username ? `@${me.username}` : `аккаунт без ника: ${me.firstName ?? me.id.toString()}`);
    console.log(
      me.premium ? "Premium: есть" : "Premium: нет — без него Telegram режет скорость скачивания мастеров",
    );

    const archive = process.env.TG_ARCHIVE_CHAT?.trim();
    if (!archive) {
      console.log("Архивный канал не проверен: задай TG_ARCHIVE_CHAT в worker/.env.");
      return;
    }

    const channel = await withTimeout(findChannel(client, archive), NETWORK_TIMEOUT_MS, "список диалогов");
    if (!channel) {
      console.log(`Канал ${archive} не найден среди диалогов аккаунта: добавь воркера в канал.`);
      process.exitCode = 1;
      return;
    }

    const result = await withTimeout(
      client.invoke(new Api.channels.GetParticipant({ channel, participant: "me" })),
      NETWORK_TIMEOUT_MS,
      "роль в канале",
    );
    const { role, warning } = describeRole(result.participant);
    console.log(`Канал «${channel.title}»: ${role}`);
    if (warning) {
      console.log(`Внимание: ${warning}`);
    }
  } finally {
    await client.destroy();
  }
}

/** Ищем среди диалогов: у приватного канала без access hash из диалогов id не разрешить. */
async function findChannel(client: TelegramClient, reference: string): Promise<Api.Channel | undefined> {
  const id = channelIdFrom(reference);
  const username = id ? undefined : reference.replace(/^(?:https?:\/\/)?t\.me\//, "").replace(/^@/, "").toLowerCase();
  for await (const dialog of client.iterDialogs({})) {
    const entity = dialog.entity;
    if (!(entity instanceof Api.Channel)) continue;
    if (id ? entity.id.toString() === id : entity.username?.toLowerCase() === username) {
      return entity;
    }
  }
  return undefined;
}

/** Принимает id из ссылки t.me/c/<id>/<пост>, id с префиксом -100 или голое число. */
function channelIdFrom(reference: string): string | undefined {
  const fromLink = /t\.me\/c\/(\d+)/.exec(reference)?.[1];
  if (fromLink) return fromLink;
  const marked = /^-100(\d+)$/.exec(reference)?.[1];
  if (marked) return marked;
  return /^\d+$/.test(reference) ? reference : undefined;
}

function describeRole(participant: Api.TypeChannelParticipant): { role: string; warning: string | undefined } {
  if (participant instanceof Api.ChannelParticipantCreator) {
    return {
      role: "владелец",
      warning: "воркер — владелец канала. При утечке сессии канал можно удалить; лучше отдельный админ.",
    };
  }
  if (participant instanceof Api.ChannelParticipantAdmin) {
    const rights = participant.adminRights;
    const extra = ADMIN_RIGHTS.filter(([key]) => rights[key] === true).map(([, label]) => label);
    return {
      role: "админ",
      warning:
        extra.length > 0
          ? `у воркера лишние права: ${extra.join(", ")}. Для скачивания хватает админа без прав.`
          : undefined,
    };
  }
  return {
    role: "участник, не админ",
    warning: "по docs/05 воркер — админ канала: админ скачивает файлы даже при запрете сохранения контента.",
  };
}

main().catch((error: unknown) => {
  console.error(error instanceof ConfigError ? error.message : describeTelegramError(error));
  process.exitCode = 1;
});
