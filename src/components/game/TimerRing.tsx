"use client";

import { useEffect, useRef, useState } from "react";
import { audio } from "@/features/audio/audio";

/**
 * Circular countdown: number + animated progress ring.
 * Warning styling at ≤5s, strong warning at ≤3s, plays warning ticks.
 * Driven by absolute deadline timestamps so it stays correct online.
 */
export function TimerRing({
  deadline,
  totalMs,
  size = 88,
}: {
  deadline: number | null;
  totalMs: number;
  size?: number;
}) {
  const [remainingMs, setRemainingMs] = useState(totalMs);
  const lastBeepSecond = useRef<number>(-1);

  useEffect(() => {
    if (deadline === null) return;
    const update = () => {
      const rem = Math.max(0, deadline - Date.now());
      setRemainingMs(rem);
      const sec = Math.ceil(rem / 1000);
      if (sec <= 5 && sec > 0 && sec !== lastBeepSecond.current) {
        lastBeepSecond.current = sec;
        audio.play("timerWarning");
      }
    };
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [deadline]);

  const seconds = Math.ceil(remainingMs / 1000);
  const fraction = totalMs > 0 ? remainingMs / totalMs : 0;
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const level = seconds <= 3 ? "critical" : seconds <= 5 ? "warning" : "normal";
  const ringColor =
    level === "critical" ? "#f87171" : level === "warning" ? "#e8b64c" : "#7c5cff";

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`${seconds} seconds remaining`}
      className={`relative inline-flex items-center justify-center ${
        level === "critical" ? "bbl-shake" : ""
      }`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#3d2f7a" strokeWidth={7} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 100ms linear, stroke 300ms" }}
        />
      </svg>
      <span
        className={`absolute text-2xl font-black tabular-nums ${
          level === "critical"
            ? "text-bbl-incorrect"
            : level === "warning"
              ? "text-bbl-gold"
              : "text-bbl-text"
        }`}
      >
        {seconds > 0 ? seconds : "⏰"}
      </span>
    </div>
  );
}
