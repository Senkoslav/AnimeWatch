/**
 * Slug тайтла из его латинского названия. Проверяется той же `slugSchema`, что и страница тайтла:
 * иначе тайтл заведётся, а открыть его будет нельзя (см. `lib/slug.ts`).
 */
import { slugSchema } from "@/lib/slug";

/** Предел из slugSchema; режем по границе слова, чтобы не оставлять обрубок. */
const MAX_LENGTH = 120;

/** Латиница с диакритикой: «Kaijuu Nº8» → «kaijuu-n-8». Остальное (кана, иероглифы) отбрасывается. */
function latinize(source: string): string {
  return source
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function truncate(slug: string): string {
  if (slug.length <= MAX_LENGTH) return slug;
  const cut = slug.slice(0, MAX_LENGTH);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 0 ? cut.slice(0, lastDash) : cut).replace(/-+$/, "");
}

/**
 * Первый свободный slug: базовый, затем с годом, затем с id. `taken` — уже занятые в базе.
 * Название на одних иероглифах даёт пустую основу, тогда сразу «anime-<id>».
 */
export function buildSlug(
  parts: { english?: string | null; name: string; year?: number | null; shikimoriId: number },
  taken: ReadonlySet<string> = new Set(),
): string {
  const base = truncate(latinize(parts.english || parts.name));
  const candidates = base
    ? [base, parts.year ? truncate(`${base}-${parts.year}`) : null, truncate(`${base}-${parts.shikimoriId}`)]
    : [];

  for (const candidate of candidates) {
    if (candidate && slugSchema.safeParse(candidate).success && !taken.has(candidate)) return candidate;
  }
  return `anime-${parts.shikimoriId}`;
}
