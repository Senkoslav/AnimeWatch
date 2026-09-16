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

/** Флаг автостарта действует недолго: иначе, не дойдя до canPlay, он запустил бы серию, открытую позже из списка. */
const AUTOPLAY_TTL_MS = 30_000;

function readAutoplayFlag(storage: Storage | undefined): { episodeId: string; at: number } | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(AUTOPLAY_KEY) ?? "null");
    if (typeof value !== "object" || value === null) return null;
    const { episodeId, at } = value as Record<string, unknown>;
    return typeof episodeId === "string" && typeof at === "number" ? { episodeId, at } : null;
  } catch {
    return null;
  }
}

/** Автопереход ставит флаг перед навигацией: следующая серия стартует сама, жест пользователя в SPA сохранён. */
export function AutoplayOnArrival({ episodeId }: { episodeId: string }) {
  const store = usePlayer();
  const canPlay = usePlayer((state) => state.canPlay);
  const shouldPlay = useRef<boolean | null>(null);

  useEffect(() => {
    // Флаг снимаем сразу при монтировании, а не на canPlay: он одноразовый в любом случае.
    const storage = sessionStore();
    const flag = readAutoplayFlag(storage);
    // Нет флага — решение не трогаем: в StrictMode эффект выполняется дважды, и второй проход флаг уже не найдёт.
    if (!flag) return;
    write(storage, AUTOPLAY_KEY, null);
    shouldPlay.current = flag.episodeId === episodeId && Date.now() - flag.at < AUTOPLAY_TTL_MS;
  }, [episodeId]);

  useEffect(() => {
    if (!canPlay || !shouldPlay.current) return;
    shouldPlay.current = false;
    store.play().catch(() => {
      // Браузер запретил автостарт: зритель нажмёт Play сам, контролы видны на паузе.
    });
  }, [canPlay, store]);

  return null;
}

interface Preferences {
  playbackRate?: number;
}

function readPreferences(): Preferences {
  try {
    return JSON.parse(localStore()?.getItem(PREFERENCES_KEY) ?? "{}") as Preferences;
  } catch {
    // Испорченная запись — настройки по умолчанию.
    return {};
  }
}

/** Сохраняется только по выбору зрителя в меню: перезагрузка источника сбрасывает скорость элемента на 1. */
export function savePlaybackRate(rate: number): void {
  write(
    localStore(),
    PREFERENCES_KEY,
    JSON.stringify({ ...readPreferences(), playbackRate: rate } satisfies Preferences),
  );
}

/**
 * Скорость — настройка устройства (docs/05): переживает серии и перезагрузки, в базу не идёт. Применяется к каждому
 * новому источнику, включая перезагрузку после обновления токена.
 */
export function PersistPreferences() {
  const store = usePlayer();

  useEffect(() => {
    let appliedTo: string | null | undefined;
    return store.subscribe(() => {
      const { source, canPlay } = store.state;
      if (!canPlay || source === appliedTo) return;
      appliedTo = source;
      const { playbackRate } = readPreferences();
      // Без сравнения со стором: сброс скорости при загрузке источника может пройти без ratechange,
      // и стор продолжит показывать старое значение.
      if (isKnownRate(playbackRate)) store.setPlaybackRate(playbackRate);
    });
  }, [store]);

  return null;
}

type RefreshState = "idle" | "refreshing" | "network" | "media";

/** MediaError.MEDIA_ERR_NETWORK: 403 протухшего токена hls.js отдаёт именно так. Остальное URL не вылечит. */
const MEDIA_ERR_NETWORK = 2;
const REFRESH_TIMEOUT_MS = 10_000;
/**
 * Сколько видео может ждать данные на воспроизведении, прежде чем считать это отказом. hls.js не всегда отдаёт
 * фатальную ошибку на постоянные 403: иногда просто стоит, и зритель видел бы вечный спиннер без объяснений.
 */
const STALL_LIMIT_MS = 20_000;
const STALL_CHECK_MS = 2_000;

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
        setState("network");
        return;
      }
      busy.current = true;
      lastRefresh.current = now;
      const snapshot = lastGood.current;
      setState("refreshing");
      try {
        const response = await fetch(`/api/playback/${episodeId}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`playback ${response.status}`);
        const body = (await response.json()) as { src?: unknown };
        if (typeof body.src !== "string") throw new Error("playback: в ответе нет src");
        resume.current = { ...snapshot, staleSource: store.state.source };
        store.dismissError();
        onSource(body.src);
        setState("idle");
      } catch (cause) {
        console.error("Не удалось обновить ссылку на видео", { episodeId, cause });
        setState("network");
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
          if (error.code !== MEDIA_ERR_NETWORK) {
            // Декодирование, неподдерживаемый формат: свежая ссылка не поможет, запрос к API не нужен.
            setState("media");
          } else if (!busy.current) {
            // Пока запрос за URL идёт, ошибки старого источника не важны: успех их снимет через dismissError.
            void refresh(false);
          }
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

  // Сторож зависания: таймер — внешний источник, setState в его колбэке допустим.
  useEffect(() => {
    let waitingSince: number | null = null;
    const timer = window.setInterval(() => {
      const { waiting, paused, error } = store.state;
      if (!waiting || paused || error || busy.current) {
        waitingSince = null;
        return;
      }
      waitingSince ??= Date.now();
      if (Date.now() - waitingSince < STALL_LIMIT_MS) return;
      waitingSince = null;
      // Недавно уже обновляли ссылку — refresh сам покажет сетевую ошибку по кулдауну.
      void refresh(false);
    }, STALL_CHECK_MS);
    return () => window.clearInterval(timer);
  }, [refresh, store]);

  return {
    error: state === "network" || state === "media" ? state : null,
    retry: () => void refresh(true),
  };
}

/** Ошибка: что случилось и что делать (docs/04, «Текст в интерфейсе»). */
export function PlaybackError({ kind, onRetry }: { kind: "network" | "media"; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg/95 p-6 text-center"
    >
      <p className="max-w-[40ch]">
        {kind === "network"
          ? "Не удалось загрузить серию. Проверьте соединение и попробуйте ещё раз."
          : "Этот браузер не смог воспроизвести серию. Обновите страницу или откройте её в другом браузере."}
      </p>
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
    write(sessionStore(), AUTOPLAY_KEY, JSON.stringify({ episodeId, at: Date.now() }));
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
    <div className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface p-3 sm:inset-x-auto sm:right-3">
      {/* Скринридер слышит одну фразу, а не отсчёт каждую секунду: цифры скрыты от него. */}
      <p role="status" className="text-sm">
        <span className="sr-only">{label} скоро начнётся</span>
        <span aria-hidden="true">
          {label} через {Math.max(left, 0)} с
        </span>
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
