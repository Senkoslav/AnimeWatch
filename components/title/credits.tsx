import type { TitleCredit } from "@/lib/queries/title";

/** Состав озвучки: голоса отдельно от остальных ролей. Ники текстом, пока нет страницы «Команда». */
export function Credits({ credits }: { credits: TitleCredit[] }) {
  if (credits.length === 0) return null;

  const voices = credits.filter((credit) => credit.isVoice);
  const crew = credits.filter((credit) => !credit.isVoice);

  return (
    <section aria-labelledby="credits-title" className="space-y-4">
      <h2 id="credits-title" className="text-lg font-semibold">
        Озвучка
      </h2>
      {voices.length > 0 && <CreditGroup title="Голоса" credits={voices} />}
      {crew.length > 0 && <CreditGroup title="Над релизом работали" credits={crew} />}
    </section>
  );
}

function CreditGroup({ title, credits }: { title: string; credits: TitleCredit[] }) {
  return (
    <div>
      <h3 className="text-sm text-muted">{title}</h3>
      <ul className="mt-2 space-y-1">
        {credits.map((credit) => (
          <li key={credit.id} className="flex flex-wrap gap-x-2">
            <span className="min-w-0 font-medium break-words">{credit.nickname}</span>
            <span className="min-w-0 break-words text-muted">{credit.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
