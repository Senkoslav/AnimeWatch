import Link from "next/link";

import { NewEpisodes } from "@/components/home/new-episodes";
import { OngoingRow } from "@/components/home/ongoing-row";
import { PopularList } from "@/components/home/popular-list";
import { Promo } from "@/components/home/promo";
import { Schedule } from "@/components/home/schedule";
import { button } from "@/components/ui/controls";
import { isToday, moscowWeekday } from "@/lib/format";
import { getHomeFeed, getOngoing, getPopular, getSchedule } from "@/lib/queries/home";

// docs/02, «Кеширование»: главная — ISR раз в минуту.
export const revalidate = 60;

/** Строк в панели «Вышло сегодня» справа от промо. */
const PANEL_SIZE = 3;
/** Карточек в «Новых сериях»: на десктопе это ровно ряд. */
const NEW_EPISODES = 6;
/** Постеров в «Сейчас выходит»: ряд из семи. */
const ONGOING = 7;
const POPULAR = 5;

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Главная по Main.dc.html и Home-mobile.dc.html: промо последнего выпуска, новые серии, то, что
 * выходит сейчас, популярное за всё время и расписание. Каждый блок — свой запрос, все параллельно.
 */
export default async function HomePage() {
  // Момент рендера: при ISR «N минут назад», метка «новая» и «сегодня» в расписании стареют до минуты.
  const now = new Date();
  const [{ hero, releases }, ongoing, popular, schedule] = await Promise.all([
    getHomeFeed(),
    getOngoing(ONGOING),
    getPopular(POPULAR),
    getSchedule(),
  ]);

  // Панель у промо: вышедшее сегодня, а если сегодня ничего — просто последние серии, и она так и подписана.
  const today = releases.filter((release) => isToday(release.publishedAt, now));
  const panel = (today.length > 0 ? today : releases).slice(0, PANEL_SIZE);

  const week = releases.filter((release) => now.getTime() - release.publishedAt.getTime() < WEEK);
  const fresh = (week.length > 0 ? week : releases).slice(0, NEW_EPISODES);

  return (
    <>
      <h1 className="sr-only">AnimeWatch: аниме онлайн, новые серии</h1>

      {hero ? (
        <Promo release={hero} latest={panel} allToday={today.length > 0} now={now} />
      ) : (
        // Пустое состояние зовёт в каталог, а не извиняется (docs/04, «Текст в интерфейсе»).
        <section className="mx-auto max-w-page px-4 lg:px-8 py-16">
          <p className="text-lg font-semibold">Скоро здесь появятся новые серии</p>
          <p className="mt-2 max-w-[60ch] text-muted">Каталог уже открыт — там есть что выбрать на вечер.</p>
          <Link href="/catalog" className={`${button("secondary")} mt-5`}>
            В каталог
          </Link>
        </section>
      )}

      {fresh.length > 0 && <NewEpisodes releases={fresh} withinWeek={week.length > 0} now={now} />}

      {ongoing.titles.length > 0 && <OngoingRow titles={ongoing.titles} total={ongoing.total} />}

      {(popular.length > 0 || schedule.size > 0) && (
        <div className="mx-auto grid max-w-page gap-9 px-4 lg:px-8 pt-9 lg:grid-cols-2 lg:gap-6">
          {popular.length > 0 && <PopularList titles={popular} />}
          {schedule.size > 0 && <Schedule byDay={schedule} today={moscowWeekday(now)} />}
        </div>
      )}
    </>
  );
}
