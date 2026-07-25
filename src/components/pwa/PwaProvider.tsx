"use client";

import { useEffect } from "react";
import { usePwaInstall } from "@/stores/pwaInstall";

/**
 * Wires up PWA behaviour once, near the app root:
 *  - registers the service worker (production only, to avoid dev cache churn)
 *  - captures the `beforeinstallprompt` event for a custom install UI
 *  - detects iOS / standalone so the UI can adapt
 * Renders nothing.
 */
export function PwaProvider() {
  useEffect(() => {
    const store = usePwaInstall.getState();

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari exposes this instead of the display-mode media query.
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    store._setEnv(isIOS, isStandalone);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      window.__bblInstallPrompt = e as typeof window.__bblInstallPrompt;
      usePwaInstall.getState()._setCanInstall(true);
    };
    const onAppInstalled = () => {
      window.__bblInstallPrompt = null;
      usePwaInstall.getState()._setInstalled();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failures shouldn't break the app */
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  return null;
}
