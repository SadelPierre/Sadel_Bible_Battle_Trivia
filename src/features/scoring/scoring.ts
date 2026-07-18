import type {
  AnswerRecord,
  GamePlayer,
  PlayerScoreState,
  RankedPlayer,
  ScoringStyle,
} from "@/types/game";

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
/** streak bonuses: 2-in-a-row → 10, 3 → 20, 4 → 30 … capped */
export const STREAK_BONUS_STEP = 10;
export const STREAK_BONUS_CAP = 50;

export function speedBonus(responseMs: number, timerMs: number): number {
  if (timerMs <= 0) return 0;
  const remaining = Math.max(0, timerMs - responseMs);
  return Math.round((remaining / timerMs) * MAX_SPEED_BONUS);
}

export function streakBonus(streakAfterThisAnswer: number): number {
  if (streakAfterThisAnswer < 2) return 0;
  return Math.min((streakAfterThisAnswer - 1) * STREAK_BONUS_STEP, STREAK_BONUS_CAP);
}

export type ScoreInput = {
  answerIndex: number | null;
  responseMs: number | null;
  correctAnswerIndex: number;
  timerMs: number;
  currentStreak: number;
  style: ScoringStyle;
};

/** Pure scoring for a single answer. Used identically on client (offline) and server (online). */
export function scoreAnswer(input: ScoreInput): AnswerRecord {
  const isCorrect = input.answerIndex !== null && input.answerIndex === input.correctAnswerIndex;
  if (!isCorrect) {
    return {
      answerIndex: input.answerIndex,
      responseMs: input.responseMs,
      isCorrect: false,
      basePoints: 0,
      speedBonus: 0,
      streakBonus: 0,
      totalPoints: 0,
    };
  }
  const useSpeed = input.style === "speed" || input.style === "speed+streak";
  const useStreak = input.style === "streak" || input.style === "speed+streak";
  const sBonus =
    useSpeed && input.responseMs !== null ? speedBonus(input.responseMs, input.timerMs) : 0;
  const stBonus = useStreak ? streakBonus(input.currentStreak + 1) : 0;
  return {
    answerIndex: input.answerIndex,
    responseMs: input.responseMs,
    isCorrect: true,
    basePoints: BASE_POINTS,
    speedBonus: sBonus,
    streakBonus: stBonus,
    totalPoints: BASE_POINTS + sBonus + stBonus,
  };
}

/**
 * Rank players with the specified tie-breakers:
 * 1. total score, 2. correct answers, 3. average correct-answer response time (lower wins),
 * 4. shared position if still tied.
 */
export function rankPlayers(
  players: GamePlayer[],
  scores: Record<string, PlayerScoreState>,
): RankedPlayer[] {
  const empty: PlayerScoreState = {
    score: 0,
    correctCount: 0,
    streak: 0,
    bestStreak: 0,
    correctResponseMsTotal: 0,
    answers: [],
  };
  const avgMs = (s: PlayerScoreState) =>
    s.correctCount > 0 ? s.correctResponseMsTotal / s.correctCount : Number.POSITIVE_INFINITY;

  const entries = players.map((player) => ({ player, scoreState: scores[player.id] ?? empty }));
  entries.sort((a, b) => {
    if (b.scoreState.score !== a.scoreState.score) return b.scoreState.score - a.scoreState.score;
    if (b.scoreState.correctCount !== a.scoreState.correctCount)
      return b.scoreState.correctCount - a.scoreState.correctCount;
    return avgMs(a.scoreState) - avgMs(b.scoreState);
  });

  const ranked: RankedPlayer[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    let rank = i + 1;
    if (i > 0) {
      const prev = ranked[i - 1]!;
      const tied =
        prev.scoreState.score === entry.scoreState.score &&
        prev.scoreState.correctCount === entry.scoreState.correctCount &&
        avgMs(prev.scoreState) === avgMs(entry.scoreState);
      if (tied) rank = prev.rank;
    }
    ranked.push({ ...entry, rank });
  }
  return ranked;
}

/** Winner(s): everyone sharing rank 1. */
export function winners(ranked: RankedPlayer[]): string[] {
  return ranked.filter((r) => r.rank === 1).map((r) => r.player.id);
}
