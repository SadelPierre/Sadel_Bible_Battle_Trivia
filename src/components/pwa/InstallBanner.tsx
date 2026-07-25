"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { usePwaInstall } from "@/stores/pwaInstall";
import { BRAND } from "@/lib/branding";

const SNOOZE_KEY = "bbl-install-dismissed";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // one week

/** Routes with live gameplay, where a bottom banner would overlap controls. */
function isGameRoute(pathname: string): boolean {
  return pathname.startsWith("/play/") || pathname.startsWith("/room/");
}

/**
 * Gentle, dismissible bottom nudge inviting the user to install the app.
 * Appears only when installation is actually possible and the user hasn't
 * dismissed it recently. iOS gets tap-to-see-instructions instead of a prompt.
 */
export function InstallBanner() {
  const { canInstall, installed, isIOS, isStandalone, promptInstall } = usePwaInstall();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true); // start hidden until we read storage
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
      setDismissed(Date.now() < until);
    } catch {
      setDismissed(false);
    }
  }, []);

  const eligible = !installed && !isStandalone && (canInstall || isIOS);
  const open = eligible && !dismissed && !isGameRoute(pathname);

  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* private mode — just hide for this session */
    }
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (canInstall) {
      const outcome = await promptInstall();
      if (outcome !== "unavailable") snooze();
      return;
    }
    setShowIOSHelp((v) => !v);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="w-full max-w-md rounded-2xl border border-bbl-border bg-bbl-card/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="text-3xl" aria-hidden>
                {BRAND.logoEmoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Install {BRAND.shortName}</p>
                <p className="mt-0.5 text-xs text-bbl-muted">
                  Add it to your home screen for full-screen play and offline solo rounds.
                </p>
                {(showIOSHelp || (isIOS && !canInstall && showIOSHelp)) && (
                  <p className="mt-2 text-xs leading-relaxed text-bbl-muted">
                    Tap <strong>Share</strong> in Safari, then <strong>“Add to Home Screen”</strong>.
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleInstall}
                    className="rounded-lg bg-bbl-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 cursor-pointer"
                  >
                    {isIOS && !canInstall ? "How to install" : "Install"}
                  </button>
                  <button
                    onClick={snooze}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-bbl-muted transition hover:text-bbl-text cursor-pointer"
                  >
                    Not now
                  </button>
                </div>
              </div>
              <button
                aria-label="Dismiss install prompt"
                onClick={snooze}
                className="-mr-1 -mt-1 rounded-full p-1 text-bbl-muted hover:text-bbl-text cursor-pointer"
              >
                <span aria-hidden>✕</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
