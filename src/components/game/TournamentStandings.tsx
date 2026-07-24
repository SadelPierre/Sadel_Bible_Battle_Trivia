"use client";

import { motion } from "framer-motion";
import { AVATAR_EMOJI, type GamePlayer, type PlayerScoreState } from "@/types/game";
import type { TournamentSnapshot } from "@/features/online/types";
import { rankPlayers } from "@/features/scoring/scoring";
import { PLAYER_COLOR_STYLES } from "@/lib/playerColors";
import { ScoreCounter } from "./ScoreCounter";

/**
 * The tournament field: survivors ranked at the top, eliminated players below in
 * reverse knockout order. During a live question the answered indicator shows
 * who has locked in; at reveal the just-eliminated are flagged.
 */
export function TournamentStandings({
  players,
  scores,
  tournament,
  currentIndex,
  answeredIds,
  highlightEliminated = false,
  myId,
}: {
  players: GamePlayer[];
  scores: Record<string, PlayerScoreState>;
  tournament: TournamentSnapshot;
  currentIndex: number;
  answeredIds?: Set<string>;
  /** true at reveal — flag the players eliminated by this question */
  highlightEliminated?: boolean;
  myId: string | null;
}) {
  const elimIndex = (id: string) => tournament.eliminatedAtIndex[id];
  const isOut = (id: string) => elimIndex(id) !== undefined;

  const survivors = rankPlayers(
    players.filter((p) => !isOut(p.id)),
    scores,
  );
  const eliminated = players
    .filter((p) => isOut(p.id))
    .sort((a, b) => elimIndex(b.id)! - elimIndex(a.id)!);

  return (
    <div aria-label="Tournament standings">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold text-bbl-gold">
          {tournament.survivorCount} {tournament.survivorCount === 1 ? "survivor" : "survivors"}
        </span>
        {tournament.nextCutTo !== null && (
          <span className="text-xs text-bbl-muted">next cut → {tournament.nextCutTo} remain</span>
        )}
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {survivors.map(({ player, scoreState, rank }) => {
          const c = PLAYER_COLOR_STYLES[player.color];
          return (
            <motion.div
              layout
              key={player.id}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${c.bg} ${c.border} ${
                !player.isBot && !player.connected ? "opacity-50" : ""
              }`}
            >
              <span className="w-6 text-center text-xs font-black text-bbl-gold">
                {rank === 1 ? "👑" : `#${rank}`}
              </span>
              <span aria-hidden>{AVATAR_EMOJI[player.avatar]}</span>
              <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${c.text}`}>
                {player.name}
                {player.id === myId && <span className="text-bbl-muted"> (you)</span>}
              </span>
              {answeredIds && (
                <span className="text-xs" aria-label={answeredIds.has(player.id) ? "answered" : "thinking"}>
                  {answeredIds.has(player.id) ? "✅" : "…"}
                </span>
              )}
              <ScoreCounter value={scoreState.score} className="ml-auto text-sm font-black" />
            </motion.div>
          );
        })}

        {eliminated.map((player) => {
          const justOut = highlightEliminated && elimIndex(player.id) === currentIndex;
          return (
            <motion.div
              layout
              key={player.id}
              initial={justOut ? { opacity: 1 } : false}
              animate={justOut ? { opacity: [1, 0.4], x: [0, 4, -4, 0] } : { opacity: 0.4 }}
              className={`flex items-center gap-2 rounded-lg border border-bbl-border px-2.5 py-1 ${
                justOut ? "bg-bbl-incorrect/15" : "bg-transparent"
              }`}
            >
              <span className="w-6 text-center text-xs" aria-hidden>💀</span>
              <span aria-hidden className="opacity-60">{AVATAR_EMOJI[player.avatar]}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-bbl-muted line-through">
                {player.name}
                {player.id === myId && <span> (you)</span>}
              </span>
              <span className="text-[10px] font-bold uppercase text-bbl-incorrect">
                {justOut ? "eliminated" : `out · Q${elimIndex(player.id)! + 1}`}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
