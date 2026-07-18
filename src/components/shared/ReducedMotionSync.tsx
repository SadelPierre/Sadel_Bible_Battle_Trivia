"use client";

import { useEffect } from "react";
import { usePreferences } from "@/stores/preferences";

/** Mirrors the in-app reduced-motion preference onto <html> for the CSS kill-switch. */
export function ReducedMotionSync() {
  const reducedMotion = usePreferences((s) => s.reducedMotion);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = reducedMotion ? "true" : "false";
  }, [reducedMotion]);
  return null;
}
