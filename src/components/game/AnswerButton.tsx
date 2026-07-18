"use client";

import { audio } from "@/features/audio/audio";

const LETTERS = ["A", "B", "C", "D"] as const;

type RevealState = "none" | "correct" | "incorrect" | "dimmed";

/**
 * Large answer option. During the question it is neutral; at reveal it shows
 * correct (glow + ✓) / incorrect-selected (shake + ✗) / dimmed states.
 * Correctness is never shown by color alone (icons + text labels).
 */
export function AnswerButton({
  index,
  text,
  selected,
  disabled,
  reveal = "none",
  onSelect,
}: {
  index: number;
  text: string;
  selected: boolean;
  disabled: boolean;
  reveal?: RevealState;
  onSelect?: (index: number) => void;
}) {
  const revealClasses =
    reveal === "correct"
      ? "border-bbl-correct bg-bbl-correct/15 bbl-correct-pulse"
      : reveal === "incorrect"
        ? "border-bbl-incorrect bg-bbl-incorrect/15 bbl-shake"
        : reveal === "dimmed"
          ? "opacity-50"
          : selected
            ? "border-bbl-gold bg-bbl-gold/10"
            : "border-bbl-border bg-bbl-card hover:border-bbl-primary hover:bg-bbl-primary-soft/40";

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Answer ${LETTERS[index]}: ${text}${
        reveal === "correct" ? " (correct answer)" : reveal === "incorrect" ? " (incorrect)" : ""
      }`}
      className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 p-4 text-left text-base font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none sm:text-lg cursor-pointer ${revealClasses}`}
      onClick={() => {
        audio.unlock();
        audio.play("click");
        onSelect?.(index);
      }}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
          reveal === "correct"
            ? "bg-bbl-correct text-black"
            : reveal === "incorrect"
              ? "bg-bbl-incorrect text-white"
              : "bg-bbl-primary-soft text-bbl-text"
        }`}
        aria-hidden
      >
        {reveal === "correct" ? "✓" : reveal === "incorrect" ? "✗" : LETTERS[index]}
      </span>
      <span className="flex-1">{text}</span>
    </button>
  );
}
