/**
 * Tournament logic: survival elimination with a head-to-head duel final.
 *
 * This is a pure layer on top of the shared game engine. The reducer delegates
 * to these functions whenever `state.tournament` is present, so tournaments
 * reuse the exact same question/reveal/scoring machinery as every other mode —
 * they only add two things:
 *
 *   1. Field stage — after each question the whole surviving pack is ranked by
 *      cumulative score and cut down to a target that shrinks every round until
 *      exactly two finalists remain (see `buildSurvivorSchedule`).
 *   2. Duel stage — the final two play sudden-death questions; each question is
 *      won outright (correct beats wrong; both correct → faster wins) and the
 *      first to `DUEL_WINS_TO_WIN` is crowned champion.
 *
 * Everything is deterministic: ties are broken all the way down to a stable
 * player-id ordering so the field always converges to a single champion.
 */
import type { GamePlayer, GameState, PlayerScoreState } from "@/types/game";
import { DUEL_FINALISTS, DUEL_WINS_TO_WIN } from "@/types/game";
import { rankPlayers } from "@/features/scoring/scoring";

/**
 * Target survivor counts after each field-stage elimination, strictly
 * decreasing from `startCount` down to `finalists`. Each round keeps ~60% of the
 * field (always cutting at least one), which brings 30 players to a duel in six
 * elimination questions: 30 → 18 → 11 → 7 → 5 → 3 → 2.
 */
export function buildSurvivorSchedule(
  startCount: number,
  finalists: number = DUEL_FINALISTS,
): number[] {
  const schedule: number[] = [];
  let n = startCount;
  while (n > finalists) {
    let next = Math.max(finalists, Math.ceil(n * 0.6));
    if (next >= n) next = n - 1; // guarantee progress even for tiny fields
    schedule.push(next);
    n = next;
  }
  return schedule;
}

/** Was this player already eliminated before the current question? */
export function isEliminated(state: GameState, playerId: string): boolean {
  return state.tournament?.eliminatedAtIndex[playerId] !== undefined;
}

/** Players still in the running (not yet eliminated). */
export function activeSurvivors(state: GameState): GamePlayer[] {
  return state.players.filter((p) => !isEliminated(state, p.id));
}

/**
 * Deterministic ranking of a set of players by cumulative score, using the
 * game's tie-breakers and finally a stable player-id order so there is always a
 * strict worst-to-best sequence to cut from.
 */
function orderWorstToBest(
  players: GamePlayer[],
  scores: Record<string, PlayerScoreState>,
): GamePlayer[] {
  const ranked = rankPlayers(players, scores); // best-to-worst, shared ranks on ties
  const byId = new Map(players.map((p) => [p.id, p]));
  // rankPlayers is a stable sort; append id as the final deterministic tiebreak.
  const bestToWorst = ranked
    .map((r) => r.player)
    .sort((a, b) => {
      const ra = ranked.find((r) => r.player.id === a.id)!.rank;
      const rb = ranked.find((r) => r.player.id === b.id)!.rank;
      if (ra !== rb) return ra - rb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  return bestToWorst.reverse().map((p) => byId.get(p.id)!);
}

/**
 * The winner of a single duel question, or null if neither finalist won it
 * (both wrong → the duel simply continues to the next question).
 */
export function duelQuestionWinner(
  state: GameState,
  finalists: GamePlayer[],
): string | null {
  const [a, b] = finalists;
  if (!a || !b) return null;
  const ra = state.scores[a.id]?.answers[state.currentIndex] ?? null;
  const rb = state.scores[b.id]?.answers[state.currentIndex] ?? null;
  const aCorrect = ra?.isCorrect ?? false;
  const bCorrect = rb?.isCorrect ?? false;
  if (aCorrect && !bCorrect) return a.id;
  if (bCorrect && !aCorrect) return b.id;
  if (aCorrect && bCorrect) {
    const aMs = ra?.responseMs ?? Number.POSITIVE_INFINITY;
    const bMs = rb?.responseMs ?? Number.POSITIVE_INFINITY;
    if (aMs !== bMs) return aMs < bMs ? a.id : b.id;
    return a.id < b.id ? a.id : b.id; // stable tiebreak for the (near-impossible) exact tie
  }
  return null; // both wrong
}

/**
 * Apply elimination/duel bookkeeping to a freshly-revealed tournament state.
 * Called immediately after the base engine has scored the current question, so
 * the reveal screen can show exactly who survived and who is out.
 */
export function applyTournamentReveal(state: GameState): GameState {
  const t = state.tournament;
  if (!t) return state;

  const survivors = activeSurvivors(state);

  if (t.stage === "field") {
    const target = t.survivorSchedule.find((s) => s < survivors.length);
    if (target !== undefined && target < survivors.length) {
      // Cut the lowest-ranked survivors down to `target`.
      const worstToBest = orderWorstToBest(survivors, state.scores);
      const cutCount = survivors.length - target;
      const eliminated = worstToBest.slice(0, cutCount);
      const eliminatedAtIndex = { ...t.eliminatedAtIndex };
      for (const p of eliminated) eliminatedAtIndex[p.id] = state.currentIndex;
      const remaining = target;
      const nextStage = remaining <= DUEL_FINALISTS ? "duel" : "field";
      return {
        ...state,
        tournament: { ...t, eliminatedAtIndex, stage: nextStage },
      };
    }
    // Nothing left to cut in the field — the finalists are set; move to the duel.
    return { ...state, tournament: { ...t, stage: "duel" } };
  }

  // Duel stage: award the question and check for a champion.
  const winnerId = duelQuestionWinner(state, survivors);
  if (!winnerId) return state; // both wrong — replay the point on the next question
  const duelWins = { ...t.duelWins, [winnerId]: (t.duelWins[winnerId] ?? 0) + 1 };
  const championId = duelWins[winnerId]! >= DUEL_WINS_TO_WIN ? winnerId : null;
  return { ...state, tournament: { ...t, duelWins, championId } };
}

/** Have we crowned a champion (or otherwise run out of contenders)? */
export function tournamentComplete(state: GameState): boolean {
  const t = state.tournament;
  if (!t) return false;
  return t.championId !== null || activeSurvivors(state).length <= 1;
}

/**
 * Decide the final winner id(s) for a completed tournament. Normally exactly the
 * champion; if a duel is cut short by running out of questions, fall back to the
 * finalist with more duel wins, then cumulative score.
 */
export function tournamentWinnerIds(state: GameState): string[] {
  const t = state.tournament;
  if (!t) return [];
  if (t.championId) return [t.championId];
  const survivors = activeSurvivors(state);
  if (survivors.length === 1) return [survivors[0]!.id];
  if (survivors.length === 0) return [];
  // Unfinished duel: most duel wins, then best cumulative rank.
  const ordered = orderWorstToBest(survivors, state.scores).reverse(); // best-to-worst
  ordered.sort((a, b) => (t.duelWins[b.id] ?? 0) - (t.duelWins[a.id] ?? 0));
  return [ordered[0]!.id];
}
