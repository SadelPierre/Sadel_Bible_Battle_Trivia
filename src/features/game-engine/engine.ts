/**
 * The game engine: a pure state machine shared by solo, local, and online modes.
 *
 * Solo/local: the reducer runs in the browser inside a React store.
 * Online: the SAME reducer runs inside Next.js API routes; the state is persisted
 * in Postgres and clients only ever receive sanitized snapshots.
 *
 * All time values are epoch milliseconds supplied by the caller (`now`), so the
 * engine itself is deterministic and easy to test.
 */
import type {
  AnswerRecord,
  BibleQuestion,
  GamePlayer,
  GameSettings,
  GameState,
  PlayerScoreState,
} from "@/types/game";
import { rankPlayers, scoreAnswer, winners } from "@/features/scoring/scoring";

export const COUNTDOWN_MS = 3000;
/** grace window for online latency: answers arriving slightly late still count */
export const LATE_GRACE_MS = 750;

export type GameAction =
  | { type: "COUNTDOWN_FINISHED"; now: number }
  | { type: "SUBMIT_ANSWER"; playerId: string; answerIndex: number; now: number }
  | { type: "LOCK_AND_REVEAL"; now: number } // timer expired or all answered
  | { type: "ADVANCE"; now: number }; // leave reveal/round-summary

export function createInitialScore(questionCount: number): PlayerScoreState {
  return {
    score: 0,
    correctCount: 0,
    streak: 0,
    bestStreak: 0,
    correctResponseMsTotal: 0,
    answers: new Array<AnswerRecord | null>(questionCount).fill(null),
  };
}

export function createGame(
  settings: GameSettings,
  players: GamePlayer[],
  questions: BibleQuestion[],
  now: number,
): GameState {
  if (players.length < 1) throw new Error("At least one player is required");
  if (questions.length < 1) throw new Error("At least one question is required");
  const scores: Record<string, PlayerScoreState> = {};
  for (const p of players) scores[p.id] = createInitialScore(questions.length);
  return {
    phase: "countdown",
    settings,
    players,
    questions,
    currentIndex: 0,
    questionStartedAt: null,
    questionDeadline: null,
    phaseEndsAt: now + COUNTDOWN_MS,
    pendingAnswers: {},
    scores,
    roundJustEnded: null,
    winnerIds: null,
  };
}

function startQuestion(state: GameState, now: number): GameState {
  return {
    ...state,
    phase: "question",
    questionStartedAt: now,
    questionDeadline: now + state.settings.timerSeconds * 1000,
    phaseEndsAt: null,
    pendingAnswers: {},
    roundJustEnded: null,
  };
}

export function currentQuestion(state: GameState): BibleQuestion {
  const q = state.questions[state.currentIndex];
  if (!q) throw new Error(`No question at index ${state.currentIndex}`);
  return q;
}

/** Every connected human + every bot has answered? */
export function allAnswered(state: GameState): boolean {
  return state.players
    .filter((p) => p.isBot || p.connected)
    .every((p) => state.pendingAnswers[p.id] !== undefined);
}

function applyReveal(state: GameState, now: number): GameState {
  const question = currentQuestion(state);
  const timerMs = state.settings.timerSeconds * 1000;
  const scores: Record<string, PlayerScoreState> = { ...state.scores };

  for (const player of state.players) {
    const prev = scores[player.id] ?? createInitialScore(state.questions.length);
    const pending = state.pendingAnswers[player.id];
    const record = scoreAnswer({
      answerIndex: pending ? pending.answerIndex : null,
      responseMs: pending ? pending.responseMs : null,
      correctAnswerIndex: question.correctAnswerIndex,
      timerMs,
      currentStreak: prev.streak,
      style: state.settings.scoringStyle,
    });
    const answers = [...prev.answers];
    answers[state.currentIndex] = record;
    const streak = record.isCorrect ? prev.streak + 1 : 0;
    scores[player.id] = {
      score: prev.score + record.totalPoints,
      correctCount: prev.correctCount + (record.isCorrect ? 1 : 0),
      streak,
      bestStreak: Math.max(prev.bestStreak, streak),
      correctResponseMsTotal:
        prev.correctResponseMsTotal + (record.isCorrect && record.responseMs ? record.responseMs : 0),
      answers,
    };
  }

  return {
    ...state,
    phase: "reveal",
    scores,
    questionDeadline: null,
    phaseEndsAt: now + state.settings.revealSeconds * 1000,
  };
}

/**
 * Reducer. Invalid actions for the current phase are ignored (state returned
 * unchanged) so duplicate client requests / race conditions cannot corrupt the game.
 */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "COUNTDOWN_FINISHED": {
      if (state.phase !== "countdown") return state;
      return startQuestion(state, action.now);
    }

    case "SUBMIT_ANSWER": {
      if (state.phase !== "question") return state;
      const { playerId, answerIndex, now } = action;
      if (!state.players.some((p) => p.id === playerId)) return state;
      // one answer per player per question
      if (state.pendingAnswers[playerId] !== undefined) return state;
      if (answerIndex < 0 || answerIndex > 3) return state;
      const started = state.questionStartedAt ?? now;
      const deadline = state.questionDeadline ?? now;
      // reject answers after the deadline (+ small grace for network latency)
      if (now > deadline + LATE_GRACE_MS) return state;
      const responseMs = Math.max(0, Math.min(now - started, state.settings.timerSeconds * 1000));
      return {
        ...state,
        pendingAnswers: {
          ...state.pendingAnswers,
          [playerId]: { answerIndex, responseMs, submittedAt: now },
        },
      };
    }

    case "LOCK_AND_REVEAL": {
      if (state.phase !== "question") return state;
      return applyReveal(state, action.now);
    }

    case "ADVANCE": {
      const { now } = action;
      if (state.phase === "reveal") {
        const isLast = state.currentIndex >= state.questions.length - 1;
        if (isLast) {
          const ranked = rankPlayers(state.players, state.scores);
          return {
            ...state,
            phase: "complete",
            phaseEndsAt: null,
            winnerIds: winners(ranked),
          };
        }
        const finishedNumber = state.currentIndex + 1; // 1-based count of finished questions
        const endOfRound =
          state.settings.roundSize > 0 && finishedNumber % state.settings.roundSize === 0;
        if (endOfRound) {
          return {
            ...state,
            phase: "round-summary",
            roundJustEnded: Math.ceil(finishedNumber / state.settings.roundSize),
            phaseEndsAt: now + state.settings.revealSeconds * 1000,
          };
        }
        return startQuestion({ ...state, currentIndex: state.currentIndex + 1 }, now);
      }
      if (state.phase === "round-summary") {
        return startQuestion({ ...state, currentIndex: state.currentIndex + 1 }, now);
      }
      return state;
    }

    default:
      return state;
  }
}

/** Convenience: should the engine lock now? (timer expired or everyone answered) */
export function shouldReveal(state: GameState, now: number): boolean {
  if (state.phase !== "question") return false;
  if (allAnswered(state)) return true;
  return state.questionDeadline !== null && now >= state.questionDeadline;
}

export { rankPlayers, winners };
