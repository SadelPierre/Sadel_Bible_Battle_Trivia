"use client";

import { motion } from "framer-motion";
import { AVATAR_EMOJI, DUEL_WINS_TO_WIN, type GamePlayer } from "@/types/game";
import type { TournamentSnapshot } from "@/features/online/types";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";
import { EASE_OUT } from "@/lib/motion";

/** Head-to-head header for the duel final: the two finalists and their point pips. */
export function DuelPanel({
  finalists,
  tournament,
  myId,
}: {
  finalists: GamePlayer[];
  tournament: TournamentSnapshot;
  myId: string | null;
}) {
  return (
    <div className="flex items-stretch justify-center gap-3">
      {finalists.map((p, i) => {
        const c = PLAYER_COLOR_STYLES[p.color];
        const wins = tournament.duelWins[p.id] ?? 0;
        const isChamp = tournament.championId === p.id;
        return (
          <div key={p.id} className="contents">
            {i === 1 && (
              <div className="flex flex-col items-center justify-center px-1">
                <span className="text-lg font-black text-bbl-gold">VS</span>
              </div>
            )}
            <motion.div
              layout
              animate={isChamp ? { scale: [1, 1.06, 1] } : {}}
              className={`flex flex-1 flex-col items-center rounded-2xl border p-4 ${c.bg} ${
                isChamp ? "border-bbl-gold" : c.border
              }`}
            >
              <span className="text-3xl" aria-hidden>{AVATAR_EMOJI[p.avatar]}</span>
              <span className={`mt-1 max-w-full truncate text-sm font-bold ${c.text}`}>
                {p.name}
                {p.id === myId && <span className="text-bbl-muted"> (you)</span>}
              </span>
              <div className="mt-2 flex gap-1.5" aria-label={`${wins} of ${DUEL_WINS_TO_WIN} points`}>
                {Array.from({ length: DUEL_WINS_TO_WIN }, (_, k) => {
                  const filled = k < wins;
                  // The pip that was just won pops; the rest only cross-fade.
                  const justWon = k === wins - 1;
                  return (
                    <motion.span
                      key={k}
                      animate={filled && justWon ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                      transition={{ duration: 0.35, ease: EASE_OUT }}
                      className={`h-3 w-3 rounded-full border transition-colors duration-200 ${
                        filled ? "bg-bbl-gold border-bbl-gold" : "border-bbl-muted/50"
                      }`}
                      style={{ transitionTimingFunction: "var(--bbl-ease-out)" }}
                    />
                  );
                })}
              </div>
              {isChamp && <span className="mt-1 text-xs font-black text-bbl-gold">👑 CHAMPION</span>}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
