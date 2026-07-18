import { AVATAR_EMOJI, type GamePlayer } from "@/types/game";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";

export function PlayerChip({
  player,
  suffix,
  size = "md",
}: {
  player: GamePlayer;
  suffix?: React.ReactNode;
  size?: "sm" | "md";
}) {
  const c = PLAYER_COLOR_STYLES[player.color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${c.bg} ${c.border} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      <span aria-hidden>{AVATAR_EMOJI[player.avatar]}</span>
      <span className={`font-semibold ${c.text}`}>{player.name}</span>
      {player.isBot && (
        <span className="text-bbl-muted text-[0.7em] uppercase tracking-wide">
          {player.botDifficulty}
        </span>
      )}
      {suffix}
    </span>
  );
}
