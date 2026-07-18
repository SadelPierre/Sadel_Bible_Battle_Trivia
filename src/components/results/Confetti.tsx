"use client";

import { useMemo } from "react";
import { usePreferences } from "@/stores/preferences";

const COLORS = ["#e8b64c", "#7c5cff", "#34d399", "#f87171", "#38bdf8", "#f5f1e6"];

/** Lightweight CSS confetti (no dependency); disabled under reduced motion. */
export function Confetti({ count = 90 }: { count?: number }) {
  const reducedMotion = usePreferences((s) => s.reducedMotion);
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 3 + Math.random() * 3,
        color: COLORS[i % COLORS.length]!,
        size: 6 + Math.random() * 8,
        round: Math.random() > 0.5,
      })),
    [count],
  );
  if (reducedMotion) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="bbl-confetti absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 0.5),
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
