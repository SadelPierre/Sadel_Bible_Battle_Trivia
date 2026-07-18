import type { PlayerColor } from "@/types/game";

/**
 * Accessible, distinguishable player colors (static Tailwind classes so the
 * compiler keeps them). Chosen for contrast against the dark theme and for
 * distinguishability including common color-vision deficiencies — players are
 * ALSO always identified by avatar + name, never color alone.
 */
export const PLAYER_COLOR_STYLES: Record<
  PlayerColor,
  { bg: string; border: string; text: string; solid: string }
> = {
  royal: { bg: "bg-indigo-500/20", border: "border-indigo-400", text: "text-indigo-300", solid: "bg-indigo-500" },
  crimson: { bg: "bg-red-500/20", border: "border-red-400", text: "text-red-300", solid: "bg-red-500" },
  emerald: { bg: "bg-emerald-500/20", border: "border-emerald-400", text: "text-emerald-300", solid: "bg-emerald-500" },
  amber: { bg: "bg-amber-500/20", border: "border-amber-400", text: "text-amber-300", solid: "bg-amber-500" },
  violet: { bg: "bg-purple-500/20", border: "border-purple-400", text: "text-purple-300", solid: "bg-purple-500" },
  teal: { bg: "bg-teal-500/20", border: "border-teal-400", text: "text-teal-300", solid: "bg-teal-500" },
  rose: { bg: "bg-pink-500/20", border: "border-pink-400", text: "text-pink-300", solid: "bg-pink-500" },
  sky: { bg: "bg-sky-500/20", border: "border-sky-400", text: "text-sky-300", solid: "bg-sky-500" },
};
