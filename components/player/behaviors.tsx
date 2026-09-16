"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AUTOPLAY_KEY, positionKey, PREFERENCES_KEY, readNumber, resumeFrom } from "@/lib/player/position";
import { isKnownRate } from "@/lib/player/rates";
import type { EpisodeRoute } from "@/lib/routes";

import { usePlayer } from "./store";

const SAVE_INTERVAL_MS = 5_000;
/** Не чаще раза в минуту: настоящий 403 (чужой домен, отозванный доступ) не должен зациклить запросы. */
const REFRESH_COOLDOWN_MS = 60_000;
const NEXT_EPISODE_DELAY_SECONDS = 5;

function sessionStore(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function localStore(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function write(storage: Storage | undefined, key: string, value: string | null): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // Квота или запрет хранилища: позиция и настройки — удобство, без них плеер работает.
  }
}

/** Память позиции анонима во вкладке (docs/03). Запись в базу для вошедших — задача «Сохранение прогресса». */
export function ResumePosition({ episodeId }: { episodeId: string }) {
  const store = usePlayer();
  const canPlay = usePlayer((state) => state.canPlay);
  const duration = usePlayer((state) => state.duration);
  const currentTime = usePlayer((state) => state.currentTime);
  const ended = usePlayer((state) => state.ended);
  const restored = useRef(false);
  const lastSaved = useRef(0);
  const latestTime = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    if (restored.current || !canPlay || duration <= 0) return;
    restored.current = true;
    const from = resumeFrom(readNumber(sessionStore(), positionKey(episodeId)), duration);
    if (from !== null) void store.seek(from);
  }, [canPlay, duration, episodeId, store]);

  useEffect(() => {
    latestTime.current = currentTime;
    if (!restored.current || finished.current || currentTime <= 0) return;
    const now = Date.now();
    if (now - lastSaved.current < SAVE_INTERVAL_MS) return;
    lastSaved.current = now;
    write(sessionStore(), positionKey(episodeId), String(Math.floor(currentTime)));
  }, [currentTime, episodeId]);

  useEffect(() => {
    // Досмотрел — в следующий раз сначала, и уход со страницы позицию уже не пишет.
    finished.current = ended;
    if (ended) write(sessionStore(), positionKey(episodeId), null);
  }, [ended, episodeId]);

  useEffect(() => {
    const save = () => {
      if (restored.current && !finished.current && latestTime.current > 0) {
        write(sessionStore(), positionKey(episodeId), String(Math.floor(latestTime.current)));
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, [episodeId]);

  return null;
}

/** Автопереход ставит флаг перед навигацией: следующая серия стартует сама, жест пользователя в SPA сохранён. */
export function AutoplayOnArrival({ episodeId }: { episodeId: string }) {
  const store = usePlayer();
  const canPlay = usePlayer((state) => state.canPlay);
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !canPlay) return;
    done.current = true;
    const storage = sessionStore();
    let flag: string | null = null;
    try {
      flag = storage?.getItem(AUTOPLAY_KEY) ?? null;
    } catch {
      flag = null;
    }
    if (flag !== episodeId) return;
    write(storage, AUTOPLAY_KEY, null);
    store.play().catch(() => {
      // Браузер запретил автостарт: зритель нажмёт Play сам, контролы видны на паузе.
    });
  }, [canPlay, episodeId, store]);

  return null;
}

interface Preferences {
  playbackRate?: number;
}

/** Скорость — настройка устройства (docs/05): переживает серии и перезагрузки, в базу не идёт. */
export function PersistPreferences() {
  const store = usePlayer();
  const canPlay = usePlayer((state) => state.canPlay);
  const playbackRate = usePlayer((state) => state.playbackRate);
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !canPlay) return;
    applied.current = true;
    try {
      const saved = JSON.parse(localStore()?.getItem(PREFERENCES_KEY) ?? "{}") as Preferences;
      if (isKnownRate(saved.playbackRate)) {
        store.setPlaybackRate(saved.playbackRate);
      }
    } catch {
      // Испорченная запись — остаёмся на скорости по умолчанию.
    }
  }, [canPlay, store]);

  useEffect(() => {
    if (!applied.current) return;
    write(localStore(), PREFERENCES_KEY, JSON.stringify({ playbackRate } satisfies Preferences));
  }, [playbackRate]);

  return null;
}

type RefreshState = "idle" | "refreshing" | "failed";

/**
 * Токен протух на долгой паузе или истёк срок URL: CDN отвечает 403, плеер получает сетевую ошибку.
 * Берём свежий URL у сервера, ставим его и возвращаем позицию и паузу (открытый вопрос из docs/06).
 */
export function useTokenRefresh(episodeId: string, onSource: (src: string) => void) {
  const store = usePlayer();
  const [state, setState] = useState<RefreshState>("idle");
  const busy = useRef(false);
  const lastRefresh = useRef(0);
  /** Последнее состояние до ошибки: к моменту ошибки элемент уже стоит на паузе, а позиция может сброситься. */
  const lastGood = useRef({ time: 0, playing: false });
  /** Куда вернуться, когда новый источник загрузится. staleSource — источник, который был до обновления. */
  const resume = useRef<{ time: number; playing: boolean; staleSource: string | null } | null>(null);

  const refresh = useCallback(
    async (force: boolean) => {
      if (busy.current) return;
      const now = Date.now();
      if (!force && now - lastRefresh.current < REFRESH_COOLDOWN_MS) {
        setState("failed");
        return;
      }
      busy.current = true;
      lastRefresh.current = now;
      const snapshot = lastGood.current;
      setState("refreshing");
      try {
        const response = await fetch(`/api/playback/${episodeId}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`playback ${response.status}`);
        const body = (await response.json()) as { src?: unknown };
        if (typeof body.src !== "string") throw new Error("playback: в ответе нет src");
        resume.current = { ...snapshot, staleSource: store.state.source };
        store.dismissError();
        onSource(body.src);
        setState("idle");
      } catch (cause) {
        console.error("Не удалось обновить ссылку на видео", { episodeId, cause });
        setState("failed");
      } finally {
        busy.current = false;
      }
    },
    [episodeId, onSource, store],
  );

  // Стор плеера — внешняя система: реагируем подпиской, а не setState в эффекте по селектору.
  useEffect(
    () =>
      store.subscribe(() => {
        const { error, paused, currentTime, canPlay, source } = store.state;
        if (error) {
          if (!busy.current) void refresh(false);
          return;
        }
        const target = resume.current;
        if (target) {
          // Возвращаемся, только когда загрузился новый источник: canPlay старого не в счёт. Сравнивать с URL
          // плейлиста нельзя — при MSE в source лежит blob:-адрес, он меняется при каждой загрузке.
          if (source !== target.staleSource && canPlay) {
            resume.current = null;
            void store.seek(target.time).then(() => {
              if (target.playing) store.play().catch(() => undefined);
            });
          }
          return;
        }
        lastGood.current = { time: currentTime, playing: !paused };
      }),
    [refresh, store],
  );

  return { failed: state === "failed", retry: () => void refresh(true) };
}

/** Ошибка после попытки обновить ссылку: что случилось и что делать (docs/04, «Текст в интерфейсе»). */
export function PlaybackError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/95 p-6 text-center"
    >
      <p className="max-w-[40ch]">Не удалось загрузить серию. Проверьте соединение и попробуйте ещё раз.</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 items-center rounded-sm bg-text px-5 font-medium text-bg hover:bg-muted"
      >
        Попробовать снова
      </button>
    </div>
  );
}

interface NextEpisodeProps {
  episodeId: string;
  href: EpisodeRoute;
  label: string;
}

/** Автопереход: плашка с отсчётом, «Смотреть сейчас» и «Отмена». Плашка — второе разрешённое движение плеера. */
export function NextEpisode({ episodeId, href, label }: NextEpisodeProps) {
  const router = useRouter();
  const ended = usePlayer((state) => state.ended);
  const [left, setLeft] = useState(NEXT_EPISODE_DELAY_SECONDS);
  const [cancelled, setCancelled] = useState(false);
  const [wasEnded, setWasEnded] = useState(ended);
  // Зритель перемотал назад после конца: плашка и отсчёт снова с нуля. Сброс при рендере, а не в эффекте.
  if (ended !== wasEnded) {
    setWasEnded(ended);
    if (!ended) {
      setCancelled(false);
      setLeft(NEXT_EPISODE_DELAY_SECONDS);
    }
  }
  const active = ended && !cancelled;

  const go = useCallback(() => {
    write(sessionStore(), AUTOPLAY_KEY, episodeId);
    router.push(href);
  }, [episodeId, href, router]);

  useEffect(() => {
    if (!active) return;
    if (left <= 0) {
      go();
      return;
    }
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [active, go, left]);

  if (!active) return null;

  return (
    <div
      role="status"
      className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface p-3 sm:inset-x-auto sm:right-3"
    >
      <p className="text-sm">
        {label} через {Math.max(left, 0)} с
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={go}
          className="inline-flex min-h-11 items-center rounded-sm bg-text px-4 text-sm font-medium text-bg hover:bg-muted"
        >
          Смотреть сейчас
        </button>
        <button
          type="button"
          onClick={() => setCancelled(true)}
          className="inline-flex min-h-11 items-center rounded-sm px-3 text-sm text-muted underline hover:text-text"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
