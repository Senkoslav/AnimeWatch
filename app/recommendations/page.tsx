import type { Metadata } from "next";
import Link from "next/link";

import { AuthTrigger } from "@/components/auth/auth-trigger";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { button, PAGE_TITLE } from "@/components/ui/controls";
import { getCurrentUser } from "@/lib/auth/session";
import { getRecommendations } from "@/lib/queries/recommendations";
import { reasonText } from "@/lib/recommendations/reason";

export const metadata: Metadata = {
  title: "Рекомендации",
  robots: { index: false, follow: true },
  alternates: { canonical: "/recommendations" },
};

const LIMIT = 24;
const MOBILE_COLUMNS = 2;
const SIZES = "(min-width: 1280px) 200px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

/**
 * Рекомендации (docs/06, решение владельца 2026-09-24). Динамическая: читает сессию. У каждого совета
 * объяснение «почему» и «Не интересно». Аноним и тот, у кого отметок мало, видят честный холодный
 * старт — популярное с высокой оценкой — и приглашение, как сделать советы своими.
 */
export default async function RecommendationsPage() {
  const user = await getCurrentUser();
  const { items, personal } = await getRecommendations(user?.id ?? null, LIMIT);

  return (
    <div className="mx-auto max-w-page px-4 py-6 md:py-10 lg:px-8">
      <h1 className={PAGE_TITLE}>Рекомендации</h1>
      <p className="mt-3 max-w-[64ch] text-md text-text-2">
        {personal
          ? "Подобраны по вашим спискам и оценкам: что смотрите, что досмотрели и как оценили, что бросили. «Не интересно» убирает совет насовсем и немного меняет остальные."
          : user
            ? "Пока это популярное с высокой оценкой: отметьте хотя бы три тайтла — «смотрю», «просмотрено» или оценкой, — и советы станут вашими."
            : "Это популярное с высокой оценкой. Войдите и отмечайте тайтлы — советы подстроятся под ваши списки и оценки."}
      </p>
      {!user && (
        <div className="mt-5">
          <AuthTrigger className={button("secondary", "sm")}>Войти</AuthTrigger>
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line px-5 py-8">
          <p className="text-lg font-semibold">Советовать пока нечего</p>
          <p className="mt-2 max-w-[60ch] text-base text-muted">
            Всё, что есть в каталоге, уже у вас в списках или скрыто. Загляните в каталог — он пополняется.
          </p>
          <Link href="/catalog" className={`${button("secondary")} mt-5`}>
            В каталог
          </Link>
        </div>
      ) : (
        <ul
          aria-label="Советы"
          className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
        >
          {items.map(({ title, reason }, index) => (
            <li key={title.id}>
              <RecommendationCard
                title={title}
                reason={reasonText(reason)}
                canDismiss={user !== null}
                eager={index < MOBILE_COLUMNS}
                sizes={SIZES}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
