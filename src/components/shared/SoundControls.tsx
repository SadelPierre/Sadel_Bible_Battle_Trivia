"use client";

import { useState } from "react";
import { usePreferences } from "@/stores/preferences";
import { audio } from "@/features/audio/audio";
import { InstallButton } from "@/components/pwa/InstallButton";

/** Global mute button + expandable music/effects volume sliders + reduced motion. */
export function SoundControls() {
  const prefs = usePreferences();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          aria-label={prefs.muted ? "Unmute all sound" : "Mute all sound"}
          aria-pressed={prefs.muted}
          className="rounded-full border border-bbl-border bg-bbl-card p-2 text-lg hover:bg-bbl-primary-soft cursor-pointer"
          onClick={() => {
            audio.unlock();
            prefs.setMuted(!prefs.muted);
          }}
        >
          <span aria-hidden>{prefs.muted ? "🔇" : "🔊"}</span>
        </button>
        <button
          aria-label="Sound and accessibility settings"
          aria-expanded={open}
          className="rounded-full border border-bbl-border bg-bbl-card p-2 text-lg hover:bg-bbl-primary-soft cursor-pointer"
          onClick={() => {
            audio.unlock();
            setOpen((v) => !v);
          }}
        >
          <span aria-hidden>⚙️</span>
        </button>
      </div>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-bbl-border bg-bbl-card p-4 shadow-2xl">
          <label className="mb-3 block text-sm">
            <span className="mb-1 flex justify-between">
              <span>Sound effects</span>
              <span className="text-bbl-muted">{Math.round(prefs.sfxVolume * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.sfxVolume}
              onChange={(e) => prefs.setSfxVolume(Number(e.target.value))}
              className="w-full accent-[var(--bbl-gold)]"
            />
          </label>
          <label className="mb-3 block text-sm">
            <span className="mb-1 flex justify-between">
              <span>Music</span>
              <span className="text-bbl-muted">{Math.round(prefs.musicVolume * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.musicVolume}
              onChange={(e) => prefs.setMusicVolume(Number(e.target.value))}
              className="w-full accent-[var(--bbl-gold)]"
            />
          </label>
          <label className="mb-2 flex items-center justify-between text-sm">
            <span>Background music</span>
            <input
              type="checkbox"
              checked={prefs.musicOn}
              onChange={(e) => {
                audio.unlock();
                prefs.setMusicOn(e.target.checked);
              }}
              className="h-4 w-4 accent-[var(--bbl-gold)]"
            />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>Reduce motion</span>
            <input
              type="checkbox"
              checked={prefs.reducedMotion}
              onChange={(e) => prefs.setReducedMotion(e.target.checked)}
              className="h-4 w-4 accent-[var(--bbl-gold)]"
            />
          </label>
          <InstallButton />
        </div>
      )}
    </div>
  );
}
