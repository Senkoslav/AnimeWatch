"use client";

import {
  Controls,
  FullscreenButton,
  Menu,
  MuteButton,
  PlayButton,
  SeekButton,
  Time,
  TimeSlider,
  VolumeSlider,
} from "@videojs/react";
import {
  FullscreenEnterIcon,
  FullscreenExitIcon,
  PauseIcon,
  PlayIcon,
  QualityIcon,
  RestartIcon,
  SeekIcon,
  SpeedIcon,
  VolumeHighIcon,
  VolumeOffIcon,
} from "@videojs/react/icons";
import { QualityRadioGroup } from "@videojs/react/ui/quality-radio-group";

import { formatRate, PLAYBACK_RATES } from "@/lib/player/rates";

import { savePlaybackRate } from "./behaviors";
import { usePlayer } from "./store";

/** Кнопка контролов: 44×44, видимый фокус, без теней и стекла. Display отдельно: иначе hidden спорит с inline-flex. */
const BUTTON_LOOK =
  "size-11 shrink-0 items-center justify-center rounded-sm text-text hover:bg-surface-2 [&_svg]:size-6";
const BUTTON = `inline-flex ${BUTTON_LOOK}`;
/** Только с планшета: на телефоне перемотка — двойным тапом, громкость — кнопками телефона, а ширины 360px не хватает. */
const WIDE_BUTTON = `hidden sm:inline-flex ${BUTTON_LOOK}`;

/** Нижняя панель плеера. Показ и скрытие — одно из двух разрешённых движений на сайте (docs/04, «Движение»). */
export function PlayerControls() {
  return (
    <Controls.Root>
      <Controls.Content className="absolute inset-x-0 bottom-0 border-t border-line bg-bg/90 px-2 transition-opacity duration-200 not-data-visible:pointer-events-none not-data-visible:opacity-0">
        <TimeSlider.Root className="relative flex h-6 w-full cursor-pointer touch-none items-center">
          <TimeSlider.Track className="relative h-1 w-full overflow-hidden rounded-full bg-line">
            <TimeSlider.Buffer className="absolute inset-y-0 left-0 w-(--media-slider-buffer) bg-muted/40" />
            {/* Заполненная часть шкалы — янтарь: это то, что идёт прямо сейчас. */}
            <TimeSlider.Fill className="absolute inset-y-0 left-0 w-(--media-slider-fill) bg-signal" />
          </TimeSlider.Track>
          <TimeSlider.Thumb className="absolute left-(--media-slider-fill) size-3 -translate-x-1/2 rounded-full bg-signal" />
        </TimeSlider.Root>

        <div className="flex items-center gap-1 pb-1">
          <PlayButton className={`${BUTTON} group/play`} aria-keyshortcuts="Space k">
            <PlayIcon className="hidden group-data-paused/play:not-group-data-ended/play:block" />
            <PauseIcon className="block group-data-ended/play:hidden group-data-paused/play:hidden" />
            <RestartIcon className="hidden group-data-ended/play:block" />
          </PlayButton>
          <SeekButton seconds={-10} className={`${WIDE_BUTTON} [&_svg]:-scale-x-100`} aria-keyshortcuts="j">
            <SeekIcon />
          </SeekButton>
          <SeekButton seconds={10} className={WIDE_BUTTON} aria-keyshortcuts="l">
            <SeekIcon />
          </SeekButton>

          <MuteButton className={`${WIDE_BUTTON} group/mute`} aria-keyshortcuts="m">
            <VolumeHighIcon className="block group-data-muted/mute:hidden" />
            <VolumeOffIcon className="hidden group-data-muted/mute:block" />
          </MuteButton>
          <VolumeSlider.Root className="relative hidden h-11 w-20 cursor-pointer touch-none items-center sm:flex">
            <VolumeSlider.Track className="relative h-1 w-full overflow-hidden rounded-full bg-line">
              <VolumeSlider.Fill className="absolute inset-y-0 left-0 w-(--media-slider-fill) bg-text" />
            </VolumeSlider.Track>
            <VolumeSlider.Thumb className="absolute left-(--media-slider-fill) size-3 -translate-x-1/2 rounded-full bg-text" />
          </VolumeSlider.Root>

          <Time.Group className="ml-2 text-sm whitespace-nowrap text-muted tabular-nums">
            <Time.Value type="current" className="text-text" />
            <Time.Separator className="px-1"> / </Time.Separator>
            <Time.Value type="duration" />
          </Time.Group>

          <div className="ml-auto flex items-center gap-1">
            <QualityMenu />
            <SpeedMenu />
            <FullscreenButton className={`${BUTTON} group/fs`} aria-keyshortcuts="f">
              <FullscreenEnterIcon className="block group-data-fullscreen/fs:hidden" />
              <FullscreenExitIcon className="hidden group-data-fullscreen/fs:block" />
            </FullscreenButton>
          </div>
        </div>
      </Controls.Content>
    </Controls.Root>
  );
}

const ITEM =
  "flex min-h-11 w-full cursor-pointer items-center justify-between gap-6 rounded-sm px-3 text-sm text-text data-highlighted:bg-surface-2";
/** Меню — единственное место на сайте с тенью (docs/04, «Токены»). */
const POPUP =
  "z-10 max-h-(--media-menu-available-height) min-w-40 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-menu";

function QualityMenu() {
  return (
    <Menu.Root side="top" align="end">
      <QualityRadioGroup.Root>
        <Menu.Trigger className={BUTTON} aria-label="Качество">
          <QualityIcon />
        </Menu.Trigger>
        <Menu.Popup className={POPUP}>
          <Menu.Content>
            <QualityRadioGroup.Options
              renderItem={(props, item) => (
                <Menu.RadioItem {...props} className={ITEM}>
                  <span>{item.label}</span>
                  <Menu.ItemIndicator checked={item.checked} className="text-signal">
                    ✓
                  </Menu.ItemIndicator>
                </Menu.RadioItem>
              )}
            />
          </Menu.Content>
        </Menu.Popup>
      </QualityRadioGroup.Root>
    </Menu.Root>
  );
}

function SpeedMenu() {
  const store = usePlayer();
  const playbackRate = usePlayer((state) => state.playbackRate);

  return (
    <Menu.Root side="top" align="end">
      <Menu.Trigger className={BUTTON} aria-label={`Скорость: ${formatRate(playbackRate)}`}>
        <SpeedIcon />
      </Menu.Trigger>
      <Menu.Popup className={POPUP}>
        <Menu.Content>
          <Menu.RadioGroup
            aria-label="Скорость"
            value={String(playbackRate)}
            onValueChange={(value) => {
              store.setPlaybackRate(Number(value));
              savePlaybackRate(Number(value));
            }}
          >
            {PLAYBACK_RATES.map((rate) => (
              <Menu.RadioItem key={rate} value={String(rate)} className={ITEM}>
                <span>{formatRate(rate)}</span>
                <Menu.ItemIndicator checked={rate === playbackRate} className="text-signal">
                  ✓
                </Menu.ItemIndicator>
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Popup>
    </Menu.Root>
  );
}
