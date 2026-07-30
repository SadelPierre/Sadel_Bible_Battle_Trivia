"use client";

import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  type BibleCategory,
  type GameSettings,
} from "@/types/game";
import { OptionPills } from "./OptionPills";
import { audio } from "@/features/audio/audio";

/** Shared game-settings editor (questions, timer, difficulty, categories, scoring). */
export function GameSettingsForm({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (s: GameSettings) => void;
}) {
  const selectedCategories: BibleCategory[] =
    settings.categories === "mixed" ? [] : settings.categories;

  const toggleCategory = (cat: BibleCategory) => {
    audio.play("click");
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    onChange({ ...settings, categories: next.length === 0 ? "mixed" : next });
  };

  return (
    <div className="space-y-5">
      <OptionPills
        label="Number of questions"
        options={[5, 10, 15, 20] as const}
        value={([5, 10, 15, 20] as const).includes(settings.questionCount as 5 | 10 | 15 | 20) ? settings.questionCount : 10}
        onChange={(v) => onChange({ ...settings, questionCount: v })}
      />
      <OptionPills
        label="Seconds per question"
        options={[10, 15, 20, 30] as const}
        value={settings.timerSeconds}
        onChange={(v) => onChange({ ...settings, timerSeconds: v })}
        renderLabel={(v) => `${v}s`}
      />
      <OptionPills
        label="Question difficulty"
        options={["easy", "medium", "hard", "mixed"] as const}
        value={settings.difficulty}
        onChange={(v) => onChange({ ...settings, difficulty: v })}
        renderLabel={(v) => v[0]!.toUpperCase() + v.slice(1)}
      />
      <OptionPills
        label="Scoring style"
        options={["standard", "speed", "streak", "speed+streak"] as const}
        value={settings.scoringStyle}
        onChange={(v) => onChange({ ...settings, scoringStyle: v })}
        renderLabel={(v) =>
          v === "standard"
            ? "Standard"
            : v === "speed"
              ? "⚡ Speed bonus"
              : v === "streak"
                ? "🔥 Streak bonus"
                : "⚡+🔥 Both"
        }
      />
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-bbl-muted">
          Categories{" "}
          <span className="font-normal">(none selected = mixed from all categories)</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((cat) => {
            const active = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] cursor-pointer ${
                  active
                    ? "border-bbl-gold bg-bbl-gold/20 text-bbl-gold"
                    : "border-bbl-border bg-bbl-card text-bbl-muted hover:border-bbl-primary hover:text-bbl-text"
                }`}
                onClick={() => toggleCategory(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
