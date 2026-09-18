import { Hero } from "@/components/home/hero";
import { ReleaseCard } from "@/components/home/release-card";
import { getHomeFeed } from "@/lib/queries/home";

// docs/02, «Кеширование»: главная — ISR раз в минуту.
export const revalidate = 60;

/** Колонок ленты на телефоне: первый ряд виден без прокрутки. */
const MOBILE_COLUMNS = 2;

export default async function HomePage() {
  const { hero, releases } = await getHomeFeed();
  // Момент рендера: при ISR «N минут назад» и метка «новая» стареют до минуты после простоя. Осознанно.
  const now = new Date();

  return (
    <>
      <h1 className="sr-only">AnimeWatch: аниме онлайн, новые серии</h1>

      {hero ? (
        <Hero release={hero} now={now} />
      ) : (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-lg">Скоро здесь появятся новые серии.</p>
        </section>
      )}

      {releases.length > 0 && (
        <section aria-labelledby="fresh-title" className="mx-auto max-w-6xl px-4 pt-8">
          <h2 id="fresh-title" className="text-lg font-semibold">
            Свежее
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {releases.map((release, index) => (
              <li key={release.episodeId}>
                <ReleaseCard release={release} now={now} eager={index < MOBILE_COLUMNS} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
