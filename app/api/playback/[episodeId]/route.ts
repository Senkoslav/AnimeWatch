import { z } from "zod";

import { getPlayback } from "@/lib/playback/server";

/**
 * Свежий подписанный URL для плеера: нужен, когда токен протух на долгой паузе (первый URL страница
 * просмотра отдаёт сама). Ответ личный и короткоживущий — ни браузер, ни CDN его не кешируют.
 */
const NO_STORE = { "Cache-Control": "private, no-store" };

/** Prisma cuid: строчные буквы и цифры. Остальное — не id, в базу не ходим. */
const episodeIdSchema = z.string().regex(/^[a-z0-9]{20,40}$/);

export async function GET(_request: Request, ctx: RouteContext<"/api/playback/[episodeId]">) {
  const parsed = episodeIdSchema.safeParse((await ctx.params).episodeId);
  if (!parsed.success) {
    return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }

  const playback = await getPlayback(parsed.data);
  if (!playback) {
    return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  }
  if (playback.status === "processing") {
    return Response.json({ error: "processing" }, { status: 409, headers: NO_STORE });
  }
  return Response.json({ src: playback.src, expiresAt: playback.expiresAt }, { headers: NO_STORE });
}
