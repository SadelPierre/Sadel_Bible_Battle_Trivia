"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { usePreferences } from "@/stores/preferences";

/**
 * Single source of truth for reduced motion.
 *
 * Two mechanisms have to agree:
 *  - CSS animations/transitions are killed by the [data-reduced-motion="true"]
 *    rules in globals.css, so this mirrors the preference onto <html>.
 *  - framer-motion never sees that attribute — it drives transforms from JS —
 *    so MotionConfig has to be told separately. "always" honours the in-app
 *    toggle; "user" falls back to the OS prefers-reduced-motion setting.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reducedMotion = usePreferences((s) => s.reducedMotion);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? "true" : "false";
  }, [reducedMotion]);

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>{children}</MotionConfig>
  );
}
