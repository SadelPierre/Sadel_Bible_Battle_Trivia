"use client";

import { useEffect, useRef, useState } from "react";
import { audio } from "@/features/audio/audio";

/** Animated counting number for score changes. */
export function ScoreCounter({ value, className = "" }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (from === value) return;
    const duration = 700;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const current = Math.round(from + (value - from) * eased);
      setDisplay((old) => {
        if (current !== old) audio.play("scoreTick");
        return current;
      });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={`tabular-nums ${className}`}>{display}</span>;
}
