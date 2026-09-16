"use client";

import { BufferingIndicator, Container, Gesture, Hotkey, StatusAnnouncer } from "@videojs/react";
import { SpinnerIcon } from "@videojs/react/icons";
import { I18nProvider } from "@videojs/react/i18n";
// Русская локаль регистрируется синхронно при импорте: подписи и aria-label русские уже в серверном HTML,
// а не после ленивой загрузки пакета на клиенте.
import "@videojs/react/i18n/locales/ru/register";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { useState } from "react";

import type { EpisodeRoute } from "@/lib/routes";

import {
  AutoplayOnArrival,
  NextEpisode,
  PersistPreferences,
  PlaybackError,
  ResumePosition,
  useTokenRefresh,
} from "./behaviors";
import { PlayerControls } from "./controls";
import { PlayerProvider } from "./store";

interface EpisodePlayerProps {
  episodeId: string;
  /** Подписанный URL плейлиста из серверного рендера: без лишнего запроса перед стартом. */
  src: string;
  next: { episodeId: string; href: EpisodeRoute; label: string } | null;
}

export function EpisodePlayer(props: EpisodePlayerProps) {
  return (
    // Локаль явно: без неё провайдер ищет lang в DOM, а на сервере DOM нет.
    <I18nProvider locale="ru">
      <PlayerProvider>
        <PlayerSurface {...props} />
      </PlayerProvider>
    </I18nProvider>
  );
}

function PlayerSurface({ episodeId, src: initialSrc, next }: EpisodePlayerProps) {
  const [src, setSrc] = useState(initialSrc);
  const { error, retry } = useTokenRefresh(episodeId, setSrc);

  return (
    <Container className="relative aspect-video w-full overflow-hidden bg-bg sm:rounded-md">
      <HlsJsVideo src={src} playsInline crossOrigin="anonymous" preload="metadata" className="size-full" />

      <BufferingIndicator className="pointer-events-none absolute inset-0 flex items-center justify-center not-data-visible:hidden">
        <SpinnerIcon className="animate-spin size-10 text-text" aria-hidden="true" />
      </BufferingIndicator>

      <PlayerControls />

      {/* Горячие клавиши действуют, пока фокус внутри плеера: Space на остальной странице не перехватываем. */}
      <Hotkey keys="Space" action="togglePaused" />
      <Hotkey keys="k" action="togglePaused" />
      <Hotkey keys="ArrowRight" action="seekStep" value={5} />
      <Hotkey keys="ArrowLeft" action="seekStep" value={-5} />
      <Hotkey keys="l" action="seekStep" value={10} />
      <Hotkey keys="j" action="seekStep" value={-10} />
      <Hotkey keys="ArrowUp" action="volumeStep" />
      <Hotkey keys="ArrowDown" action="volumeStep" />
      <Hotkey keys="m" action="toggleMuted" />
      <Hotkey keys="f" action="toggleFullscreen" />
      <Hotkey keys="0-9" action="seekToPercent" />

      <Gesture type="tap" action="togglePaused" pointer="mouse" region="center" />
      <Gesture type="tap" action="toggleControls" pointer="touch" />
      <Gesture type="doubletap" action="seekStep" value={-10} region="left" />
      <Gesture type="doubletap" action="seekStep" value={10} region="right" />

      {/* Объявления только для скринридера: на экране «Переход к отметке…» не нужен. */}
      <StatusAnnouncer className="sr-only" />
      <ResumePosition episodeId={episodeId} />
      <AutoplayOnArrival episodeId={episodeId} />
      <PersistPreferences />
      {next && <NextEpisode episodeId={next.episodeId} href={next.href} label={next.label} />}
      {error && <PlaybackError kind={error} onRetry={retry} />}
    </Container>
  );
}
