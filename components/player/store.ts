"use client";

import { createPlayer } from "@videojs/react";
import { videoFeatures } from "@videojs/react/video";

/** Один типизированный стор на все части плеера: состояние и действия берутся через usePlayer. */
export const { Player: PlayerProvider, usePlayer } = createPlayer({ features: videoFeatures });
