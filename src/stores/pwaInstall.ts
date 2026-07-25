"use client";

import { create } from "zustand";

/** The `beforeinstallprompt` event isn't in the DOM lib types yet. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaInstallState = {
  /** A native install prompt is available (Chromium desktop/Android). */
  canInstall: boolean;
  /** The app has been installed during this session, or is already running standalone. */
  installed: boolean;
  isIOS: boolean;
  /** Running as an installed app (standalone display mode). */
  isStandalone: boolean;
  /** Internal setters used by PwaProvider. */
  _setEnv: (isIOS: boolean, isStandalone: boolean) => void;
  _setCanInstall: (v: boolean) => void;
  _setInstalled: () => void;
  /** Trigger the native install flow. Returns the user's choice. */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

/** Deferred prompt lives on the window so it survives React re-renders/HMR. */
declare global {
  interface Window {
    __bblInstallPrompt: BeforeInstallPromptEvent | null;
  }
}

export const usePwaInstall = create<PwaInstallState>((set) => ({
  canInstall: false,
  installed: false,
  isIOS: false,
  isStandalone: false,
  _setEnv: (isIOS, isStandalone) => set({ isIOS, isStandalone, installed: isStandalone }),
  _setCanInstall: (canInstall) => set({ canInstall }),
  _setInstalled: () => set({ installed: true, canInstall: false }),
  promptInstall: async () => {
    const event = typeof window !== "undefined" ? window.__bblInstallPrompt : null;
    if (!event) return "unavailable";
    event.prompt();
    const { outcome } = await event.userChoice;
    window.__bblInstallPrompt = null;
    set({ canInstall: false, installed: outcome === "accepted" });
    return outcome;
  },
}));
