"use client";

import {
  AVATAR_EMOJI,
  PLAYER_AVATARS,
  PLAYER_COLORS,
  type PlayerAvatar,
  type PlayerColor,
} from "@/types/game";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";
import { MAX_NAME_LENGTH } from "@/lib/validation";
import { audio } from "@/features/audio/audio";

/** Display name + avatar + color picker. */
export function IdentityForm({
  name,
  avatar,
  color,
  error,
  onChange,
  label = "Your display name",
  takenColors = [],
}: {
  name: string;
  avatar: PlayerAvatar;
  color: PlayerColor;
  error?: string | null;
  onChange: (v: { name: string; avatar: PlayerAvatar; color: PlayerColor }) => void;
  label?: string;
  takenColors?: PlayerColor[];
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-bbl-muted">{label}</span>
        <input
          type="text"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Grace"
          aria-invalid={!!error}
          aria-describedby={error ? "name-error" : undefined}
          className="w-full rounded-xl border-2 border-bbl-border bg-bbl-bg px-4 py-2.5 text-lg font-semibold placeholder:text-bbl-muted/50 focus:border-bbl-gold focus:outline-none"
          onChange={(e) => onChange({ name: e.target.value, avatar, color })}
        />
        <span className="mt-0.5 block text-right text-xs text-bbl-muted">
          {name.length}/{MAX_NAME_LENGTH}
        </span>
      </label>
      {error && (
        <p id="name-error" role="alert" className="text-sm font-semibold text-bbl-incorrect">
          {error}
        </p>
      )}

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-bbl-muted">Avatar</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Avatar">
          {PLAYER_AVATARS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={avatar === a}
              aria-label={`Avatar ${a}`}
              className={`h-11 w-11 rounded-xl border-2 text-xl transition-transform active:scale-90 cursor-pointer ${
                avatar === a ? "border-bbl-gold bg-bbl-gold/20" : "border-bbl-border bg-bbl-card"
              }`}
              onClick={() => {
                audio.unlock();
                audio.play("click");
                onChange({ name, avatar: a, color });
              }}
            >
              {AVATAR_EMOJI[a]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-bbl-muted">Player color</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Player color">
          {PLAYER_COLORS.map((c) => {
            const taken = takenColors.includes(c) && c !== color;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={`Color ${c}${taken ? " (taken)" : ""}`}
                disabled={taken}
                className={`h-9 w-9 rounded-full border-4 transition-transform active:scale-90 disabled:opacity-25 cursor-pointer ${
                  PLAYER_COLOR_STYLES[c].solid
                } ${color === c ? "border-white" : "border-transparent"}`}
                onClick={() => {
                  audio.unlock();
                  audio.play("click");
                  onChange({ name, avatar, color: c });
                }}
              />
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
