/**
 * Shared motion vocabulary for framer-motion. The CSS equivalents live in
 * src/app/globals.css (--bbl-ease-*, --bbl-dur-*) and must be kept in sync.
 *
 * UI motion stays under 300ms; only panel-sized changes reach 450ms.
 */

/** Decelerating curve for entrances and settle-into-place motion. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Symmetric curve for two-way state changes. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/** Long, heavy curve for surfaces that slide a real distance. */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

export const DUR = {
  /** press feedback, label swaps */
  press: 0.15,
  /** small enter/exit transitions */
  fast: 0.2,
  /** panels, banners, height changes */
  panel: 0.4,
  /** a row travelling a long distance down a list */
  reorder: 0.45,
} as const;
