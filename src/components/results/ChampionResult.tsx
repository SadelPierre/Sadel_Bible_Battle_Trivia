"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AVATAR_EMOJI, type GamePlayer, type PlayerScoreState } from "@/types/game";
import type { TournamentSnapshot } from "@/features/online/types";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";
import { Card } from "@/components/shared/Card";
import { Button } from "@/components/shared/Button";
import { CopyLabel } from "@/components/shared/CopyLabel";
import { Confetti } from "./Confetti";
import { BRAND } from "@/lib/branding";

/**
 * Tournament finish: crown the champion, then rank everyone by knockout order —
 * champion, duel runner-up, then eliminated players latest-out first.
 */
export function ChampionResult({
  players,
  scores,
  tournament,
  onHome,
  onRematch,
  extraActions,
}: {
  players: GamePlayer[];
  scores: Record<string, PlayerScoreState>;
  tournament: TournamentSnapshot;
  onHome: () => void;
  onRematch?: () => void;
  extraActions?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const byId = new Map(players.map((p) => [p.id, p]));
  const elim = tournament.eliminatedAtIndex;
  const scoreOf = (id: string) => scores[id]?.score ?? 0;

  // Finish order: champion first, then survivors (duel runner-up), then the
  // eliminated latest-out first — a proper knockout placement.
  const finishOrder = [...players].sort((a, b) => {
    if (tournament.championId === a.id) return -1;
    if (tournament.championId === b.id) return 1;
    const ea = elim[a.id];
    const eb = elim[b.id];
    if (ea === undefined && eb !== undefined) return -1; // survivors above eliminated
    if (ea !== undefined && eb === undefined) return 1;
    if (ea !== undefined && eb !== undefined && ea !== eb) return eb - ea; // later out = better
    return scoreOf(b.id) - scoreOf(a.id);
  });

  const champion = tournament.championId ? byId.get(tournament.championId) : finishOrder[0];

  const shareText = [
    `🏆 ${BRAND.name} tournament — ${finishOrder.length} players:`,
    `👑 Champion: ${champion?.name ?? "—"}`,
    ...finishOrder.slice(1, 4).map((p, i) => `#${i + 2} ${p.name}`),
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
            <div className="text-6xl" aria-hidden>👑</div>
            <p className="mt-1 text-sm font-bold uppercase tracking-wide text-bbl-muted">
              Tournament champion
            </p>
            <h1 className="mt-1 text-3xl font-black text-bbl-gold bbl-glow-gold" aria-live="polite">
              {champion?.name ?? "—"} wins!
            </h1>
            <p className="mt-1 text-sm text-bbl-muted">
              Last one standing out of {finishOrder.length}. 🎉
            </p>
          </motion.div>

          <ol className="mt-6 space-y-2">
            {finishOrder.map((player, i) => {
              const c = PLAYER_COLOR_STYLES[player.color];
              const place = i + 1;
              const outAt = elim[player.id];
              const status =
                place === 1
                  ? "🏆 Champion"
                  : outAt === undefined
                    ? "🥈 Runner-up"
                    : `Eliminated Q${outAt + 1}`;
              return (
                <motion.li
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(0.08 * i, 0.6) }}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${
                    place === 1 ? "border-bbl-gold bg-bbl-gold/10" : `${c.bg} ${c.border}`
                  }`}
                >
                  <span className="w-8 text-center text-lg font-black text-bbl-gold">
                    {place === 1 ? "👑" : `#${place}`}
                  </span>
                  <span className="text-xl" aria-hidden>{AVATAR_EMOJI[player.avatar]}</span>
                  <span className={`font-bold ${place === 1 ? "text-bbl-gold" : c.text}`}>
                    {player.name}
                  </span>
                  <span className="ml-auto text-xs text-bbl-muted">{status}</span>
                  <span className="w-14 text-right text-sm font-black tabular-nums">
                    {scoreOf(player.id)}
                  </span>
                </motion.li>
              );
            })}
          </ol>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {onRematch && (
              <Button variant="gold" size="lg" onClick={onRematch}>
                🔄 New tournament
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
            <Button variant="ghost" onClick={onHome}>🏠 Home</Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
