"use client";

import { motion } from "framer-motion";
import type { GamePlayer, PlayerScoreState } from "@/types/game";
import { rankPlayers } from "@/features/scoring/scoring";
import { Card } from "@/components/shared/Card";
import { AVATAR_EMOJI } from "@/types/game";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";

/** Between-rounds standings: rankings, correct counts, fastest correct, streaks, progress. */
export function RoundSummary({
  players,
  scores,
  answeredCount,
  total,
  roundNumber,
}: {
  players: GamePlayer[];
  scores: Record<string, PlayerScoreState>;
  answeredCount: number;
  total: number;
  roundNumber: number | null;
}) {
  const ranked = rankPlayers(players, scores);

  // fastest correct answer so far
  let fastest: { player: GamePlayer; ms: number } | null = null;
  for (const p of players) {
    for (const rec of scores[p.id]?.answers ?? []) {
      if (rec?.isCorrect && rec.responseMs !== null) {
        if (!fastest || rec.responseMs < fastest.ms) fastest = { player: p, ms: rec.responseMs };
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mx-auto w-full max-w-xl"
    >
      <Card className="p-6">
        <h2 className="text-center text-2xl font-black text-bbl-gold bbl-glow-gold">
          Round {roundNumber ?? ""} Complete!
        </h2>
        <p className="mt-1 text-center text-sm text-bbl-muted">
          {answeredCount} of {total} questions finished
        </p>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bbl-primary-soft/40"
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Progress toward the final round"
        >
          <div
            className="h-full rounded-full bg-bbl-gold transition-all duration-700"
            style={{ width: `${total > 0 ? (answeredCount / total) * 100 : 0}%` }}
          />
        </div>

        <ol className="mt-5 space-y-2">
          {ranked.map(({ player, scoreState, rank }) => {
            const c = PLAYER_COLOR_STYLES[player.color];
            return (
              <li
                key={player.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${c.bg} ${c.border}`}
              >
                <span className="text-lg font-black text-bbl-gold">
                  {rank === 1 ? "👑" : `#${rank}`}
                </span>
                <span aria-hidden>{AVATAR_EMOJI[player.avatar]}</span>
                <span className={`font-bold ${c.text}`}>{player.name}</span>
                <span className="text-xs text-bbl-muted">
                  {scoreState.correctCount} correct
                  {scoreState.streak >= 2 ? ` · 🔥 ${scoreState.streak} streak` : ""}
                </span>
                <span className="ml-auto text-lg font-black tabular-nums">{scoreState.score}</span>
              </li>
            );
          })}
        </ol>

        {fastest && (
          <p className="mt-4 text-center text-sm text-bbl-muted">
            ⚡ Fastest correct answer: <strong className="text-bbl-text">{fastest.player.name}</strong>{" "}
            ({(fastest.ms / 1000).toFixed(1)}s)
          </p>
        )}
      </Card>
    </motion.div>
  );
}
