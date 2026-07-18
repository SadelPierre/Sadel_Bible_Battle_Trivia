"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { audio } from "@/features/audio/audio";
import type { PlayerAvatar, PlayerColor } from "@/types/game";

type PreferencesState = {
  muted: boolean;
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
  musicOn: boolean;
  reducedMotion: boolean;
  displayName: string;
  avatar: PlayerAvatar;
  color: PlayerColor;
  setMuted: (v: boolean) => void;
  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setMusicOn: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  setIdentity: (name: string, avatar: PlayerAvatar, color: PlayerColor) => void;
};

function syncAudio(s: Pick<PreferencesState, "muted" | "sfxVolume" | "musicVolume" | "musicOn">) {
  audio.setPreferences({
    muted: s.muted,
    sfxVolume: s.sfxVolume,
    musicVolume: s.musicVolume,
    musicOn: s.musicOn,
  });
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set, get) => ({
      muted: false,
      sfxVolume: 0.7,
      musicVolume: 0.35,
      musicOn: false,
      reducedMotion: false,
      displayName: "",
      avatar: "dove",
      color: "royal",
      setMuted: (muted) => {
        set({ muted });
        syncAudio({ ...get(), muted });
      },
      setSfxVolume: (sfxVolume) => {
        set({ sfxVolume });
        syncAudio({ ...get(), sfxVolume });
      },
      setMusicVolume: (musicVolume) => {
        set({ musicVolume });
        syncAudio({ ...get(), musicVolume });
      },
      setMusicOn: (musicOn) => {
        set({ musicOn });
        syncAudio({ ...get(), musicOn });
      },
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setIdentity: (displayName, avatar, color) => set({ displayName, avatar, color }),
    }),
    {
      name: "bbl-preferences",
      onRehydrateStorage: () => (state) => {
        if (state) syncAudio(state);
      },
    },
  ),
);
