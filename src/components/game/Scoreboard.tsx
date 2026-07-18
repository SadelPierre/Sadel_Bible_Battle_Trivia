"use client";

import { AVATAR_EMOJI, type GamePlayer, type PlayerScoreState } from "@/types/game";
import { rankPlayers } from "@/features/scoring/scoring";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";
import { ScoreCounter } from "./ScoreCounter";
import { motion } from "framer-motion";

/** Compact live standings; expands nicely from mobile to desktop. */
export function Scoreboard({
  players,
  scores,
  answeredIds,
  compact = false,
}: {
  players: GamePlayer[];
  scores: Record<string, PlayerScoreState>;
  /** players who have answered the current question (online: booleans only) */
  answeredIds?: Set<string>;
  compact?: boolean;
}) {
  const ranked = rankPlayers(players, scores);
  return (
    <div
      className={`flex ${compact ? "flex-row flex-wrap justify-center gap-2" : "flex-col gap-2"}`}
      aria-label="Scoreboard"
    >
      {ranked.map(({ player, scoreState, rank }) => {
        const c = PLAYER_COLOR_STYLES[player.color];
        return (
          <motion.div
            layout
            key={player.id}
            className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 ${c.bg} ${c.border} ${
              !player.isBot && !player.connected ? "opacity-50" : ""
            }`}
          >
            <span className="w-6 text-center text-sm font-black text-bbl-gold" aria-label={`Rank ${rank}`}>
              {rank === 1 ? "👑" : `#${rank}`}
            </span>
            <span aria-hidden>{AVATAR_EMOJI[player.avatar]}</span>
            <span className={`max-w-28 truncate text-sm font-semibold ${c.text}`}>
              {player.name}
            </span>
            {scoreState.streak >= 2 && (
              <span
                className="text-xs font-bold text-bbl-gold"
                aria-label={`${scoreState.streak} correct in a row`}
              >
                🔥{scoreState.streak}
              </span>
            )}
            {answeredIds && (
              <span
                className="text-xs"
                aria-label={answeredIds.has(player.id) ? "answered" : "thinking"}
              >
                {answeredIds.has(player.id) ? "✅" : "…"}
              </span>
            )}
            {!player.isBot && !player.connected && (
              <span className="text-xs text-bbl-muted" aria-label="disconnected">
                📡
              </span>
            )}
            <ScoreCounter value={scoreState.score} className="ml-auto text-sm font-black" />
          </motion.div>
        );
      })}
    </div>
  );
}
