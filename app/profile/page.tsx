import { Compass, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthTrigger } from "@/components/auth/auth-trigger";
import { ListRing } from "@/components/profile/list-ring";
import { RatingBars } from "@/components/profile/rating-bars";
import { RecentList } from "@/components/profile/recent-list";
import { button, PAGE_TITLE } from "@/components/ui/controls";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCount, formatDate, formatScore } from "@/lib/format";
import { getProfile } from "@/lib/queries/profile";
import { titleHref } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Профиль",
  robots: { index: false, follow: false },
};

const TITLES = ["тайтл", "тайтла", "тайтлов"] as const;

/**
 * Профиль (Profile.dc.html). Динамический: читает сессию. Только то, что сайт действительно знает —
 * списки и свои оценки. «Серий просмотрено», «часов», отзывов и настроек с макета нет: данных для
 * них у сайта нет, а выдуманные числа не рисуем (docs/06).
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return <SignedOut />;

  const profile = await getProfile(user.id);
  if (!profile) return <SignedOut />;

  const now = new Date();
  const name = user.name ?? user.email;
  const facts: [string, string][] = [
    ["В списках", String(profile.total)],
    ["Оценок поставлено", String(profile.rated)],
    ["Средняя оценка", profile.average === null ? "—" : formatScore(profile.average)],
  ];

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:py-10 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[18.5rem_minmax(0,1fr)] lg:gap-10">
        <aside className="flex flex-col gap-5 lg:sticky lg:top-sticky lg:self-start">
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- аватар с googleusercontent: оптимизатор ради 64px не нужен
              <img
                src={user.avatarUrl}
                alt=""
                width={64}
                height={64}
                referrerPolicy="no-referrer"
                className="size-16 shrink-0 rounded-full border border-line object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex size-16 shrink-0 items-center justify-center rounded-full border border-line bg-fill-2 font-display text-2xl font-bold"
              >
                {name.charAt(0).toLocaleUpperCase("ru")}
              </span>
            )}
            <div className="min-w-0">
              <h1 className={`${PAGE_TITLE} truncate`}>{name}</h1>
              <p className="mt-1 text-sm text-dim">на сайте с {formatDate(profile.memberSince)}</p>
            </div>
          </div>

          {/* Цифры живут в линованном списке, а не рядом крупных плиток (docs/04, «Диаграммы»). */}
          <dl className="overflow-hidden rounded-lg border border-line bg-surface">
            {facts.map(([label, value]) => (
              <div key={label} className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-b-0">
                <dt className="text-sm text-dim">{label}</dt>
                <dd className="font-display text-base font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {profile.continueSlug && (
            <Link href={titleHref(profile.continueSlug)} className={`${button()} w-full`}>
              <Play aria-hidden="true" className="size-4 fill-current" />
              Продолжить смотреть
            </Link>
          )}

          <Link href="/recommendations" className={`${button("secondary")} w-full`}>
            <Compass aria-hidden="true" className="size-4" />
            Рекомендации
          </Link>
        </aside>

        <div className="flex min-w-0 flex-col gap-10">
          {profile.total === 0 ? (
            <Empty
              title="Здесь появятся тайтлы, которые вы отметите"
              text="Откройте тайтл и нажмите «В список» — «Смотрю», «Запланировано», «Отложено», «Просмотрено» или «Брошено». Здесь соберутся списки и ваши оценки."
            />
          ) : (
            <>
              <section aria-labelledby="profile-lists">
                <SectionHeading id="profile-lists" className="mb-5" aside={formatCount(profile.total, TITLES)}>
                  Списки
                </SectionHeading>
                <div className="rounded-lg border border-line bg-surface p-5 md:p-6">
                  <ListRing lists={profile.lists} total={profile.total} />
                </div>
              </section>

              <section aria-labelledby="profile-ratings">
                <SectionHeading
                  id="profile-ratings"
                  className="mb-5"
                  aside={
                    profile.average === null
                      ? undefined
                      : `${formatCount(profile.rated, ["оценка", "оценки", "оценок"])}, средняя ${formatScore(profile.average)}`
                  }
                >
                  Оценки
                </SectionHeading>
                {profile.average === null ? (
                  <Empty
                    title="Оценки появятся, когда вы их поставите"
                    text="Оценка от 1 до 10 ставится на странице тайтла, под оценкой Shikimori."
                  />
                ) : (
                  <div className="rounded-lg border border-line bg-surface p-5 md:p-6">
                    <RatingBars ratings={profile.ratings} average={profile.average} />
                  </div>
                )}
              </section>

              <section aria-labelledby="profile-recent">
                <SectionHeading id="profile-recent" className="mb-5">
                  Последнее
                </SectionHeading>
                <RecentList items={profile.recent} now={now} />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Пустое место зовёт к действию, а не извиняется (docs/04, «Текст в интерфейсе»). */
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-5 py-8 md:px-8">
      <p className="text-lg font-semibold">{title}</p>
      <p className="mt-2 max-w-[60ch] text-base text-muted">{text}</p>
      <Link href="/catalog" className={`${button("secondary")} mt-5`}>
        В каталог
      </Link>
    </div>
  );
}

/** Аноним: приглашение, а не редирект — вход только окном (docs/02). */
function SignedOut() {
  return (
    <div className="mx-auto max-w-page px-4 py-10 md:py-16 lg:px-8">
      <h1 className={PAGE_TITLE}>Профиль</h1>
      <p className="mt-3 max-w-[60ch] text-md text-text-2">
        Списки и оценки живут в аккаунте и переживают смену устройства. Войдите через Google — отдельной
        регистрации нет.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <AuthTrigger className={button()}>Войти</AuthTrigger>
        <Link href="/catalog" className={button("secondary")}>
          В каталог
        </Link>
      </div>
    </div>
  );
}
