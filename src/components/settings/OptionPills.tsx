"use client";

import { audio } from "@/features/audio/audio";

/** Accessible pill-style single/multi select used across setup screens. */
export function OptionPills<T extends string | number>({
  label,
  options,
  value,
  onChange,
  renderLabel = (v) => String(v),
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  renderLabel?: (v: T) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-bold text-bbl-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((opt) => (
          <button
            key={String(opt)}
            type="button"
            role="radio"
            aria-checked={value === opt}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] cursor-pointer ${
              value === opt
                ? "border-bbl-gold bg-bbl-gold/20 text-bbl-gold"
                : "border-bbl-border bg-bbl-card text-bbl-text hover:border-bbl-primary"
            }`}
            onClick={() => {
              audio.unlock();
              audio.play("click");
              onChange(opt);
            }}
          >
            {renderLabel(opt)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
