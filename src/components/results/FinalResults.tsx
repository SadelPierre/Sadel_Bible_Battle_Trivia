"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { GamePlayer, PlayerScoreState } from "@/types/game";
import { AVATAR_EMOJI } from "@/types/game";
import { rankPlayers } from "@/features/scoring/scoring";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { CopyLabel } from "@/components/shared/CopyLabel";
import { Confetti } from "./Confetti";
import { BRAND } from "@/lib/branding";

/** Final leaderboard with winner celebration, stats, and share summary. */
export function FinalResults({
  players,
  scores,
  total,
  onPlayAgain,
  onHome,
  playAgainLabel = "Play Again",
  extraActions,
}: {
  players: GamePlayer[];
  scores: Record<string, PlayerScoreState>;
  total: number;
  onPlayAgain?: () => void;
  onHome: () => void;
  playAgainLabel?: string;
  extraActions?: React.ReactNode;
}) {
  const ranked = rankPlayers(players, scores);
  const winners = ranked.filter((r) => r.rank === 1);
  const [copied, setCopied] = useState(false);

  const shareText = [
    `🏆 ${BRAND.name} results:`,
    ...ranked.map(({ player, scoreState, rank }) => {
      const acc = total > 0 ? Math.round((scoreState.correctCount / total) * 100) : 0;
      return `${rank === 1 ? "👑" : `#${rank}`} ${player.name} — ${scoreState.score} pts (${scoreState.correctCount}/${total}, ${acc}%)`;
    }),
  ].join("\n");

  return (
    <div className="mx-auto w-full max-w-xl">
      <Confetti />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-6">
          <motion.div
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
            className="text-center"
          >
            <div className="text-6xl" aria-hidden>
              🏆
            </div>
            <h1 className="mt-2 text-3xl font-black text-bbl-gold bbl-glow-gold" aria-live="polite">
              {winners.length > 1
                ? `It's a tie: ${winners.map((w) => w.player.name).join(" & ")}!`
                : `${winners[0]?.player.name} wins!`}
            </h1>
            <p className="mt-1 text-sm text-bbl-muted">Well played, everyone. 🎉</p>
          </motion.div>

          <ol className="mt-6 space-y-2">
            {ranked.map(({ player, scoreState, rank }, i) => {
              const c = PLAYER_COLOR_STYLES[player.color];
              const accuracy = total > 0 ? Math.round((scoreState.correctCount / total) * 100) : 0;
              const avgMs =
                scoreState.correctCount > 0
                  ? scoreState.correctResponseMsTotal / scoreState.correctCount
                  : null;
              return (
                <motion.li
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 * i }}
                  className={`rounded-xl border p-3 ${c.bg} ${c.border}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-bbl-gold">
                      {rank === 1 ? "👑" : `#${rank}`}
                    </span>
                    <span className="text-xl" aria-hidden>
                      {AVATAR_EMOJI[player.avatar]}
                    </span>
                    <span className={`font-bold ${c.text}`}>{player.name}</span>
                    <span className="ml-auto text-2xl font-black tabular-nums">
                      {scoreState.score}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 pl-9 text-xs text-bbl-muted">
                    <span>
                      ✓ {scoreState.correctCount}/{total} correct
                    </span>
                    <span>🎯 {accuracy}% accuracy</span>
                    {avgMs !== null && <span>⚡ {(avgMs / 1000).toFixed(1)}s avg</span>}
                    <span>🔥 best streak {scoreState.bestStreak}</span>
                  </div>
                </motion.li>
              );
            })}
          </ol>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {onPlayAgain && (
              <Button variant="gold" size="lg" onClick={onPlayAgain}>
                {playAgainLabel}
              </Button>
            )}
            {extraActions}
            <Button
              variant="ghost"
              onClick={() => {
                void navigator.clipboard?.writeText(shareText).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              <CopyLabel copied={copied} idle="📋 Copy results" done="Copied! ✓" />
            </Button>
            <Button variant="ghost" onClick={onHome}>
              🏠 Home
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
