"use client";

import { useState } from "react";
import { usePwaInstall } from "@/stores/pwaInstall";

/**
 * Install control for the Settings popover. Renders nothing once the app is
 * installed. On Chromium it fires the native prompt; on iOS (which has no
 * install event) it reveals Add-to-Home-Screen instructions.
 */
export function InstallButton() {
  const { canInstall, installed, isIOS, isStandalone, promptInstall } = usePwaInstall();
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  if (installed || isStandalone) return null;

  const handleClick = async () => {
    if (canInstall) {
      await promptInstall();
      return;
    }
    // No native prompt (iOS, or not yet eligible): show manual instructions.
    setShowIOSHelp((v) => !v);
  };

  return (
    <div className="mt-3 border-t border-bbl-border pt-3">
      <button
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-bbl-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 cursor-pointer"
      >
        <span aria-hidden>📲</span>
        Install app
      </button>
      {(showIOSHelp || (isIOS && !canInstall)) && (
        <p className="mt-2 text-xs leading-relaxed text-bbl-muted">
          {isIOS ? (
            <>
              Tap the <span aria-hidden>􀈂</span> <strong>Share</strong> button in Safari, then choose{" "}
              <strong>“Add to Home Screen”</strong>.
            </>
          ) : (
            <>Open your browser menu and choose “Install app” or “Add to Home screen”.</>
          )}
        </p>
      )}
    </div>
  );
}
