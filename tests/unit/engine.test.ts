import { describe, expect, it } from "vitest";
import {
  COUNTDOWN_MS,
  LATE_GRACE_MS,
  allAnswered,
  createGame,
  gameReducer,
  shouldReveal,
} from "@/features/game-engine/engine";
import { DEFAULT_SETTINGS, type BibleQuestion, type GamePlayer } from "@/types/game";

const q = (id: string, correct = 0): BibleQuestion => ({
  id,
  question: `Test question ${id} about a Bible fact?`,
  options: ["Answer A", "Answer B", "Answer C", "Answer D"],
  correctAnswerIndex: correct,
  bibleReference: "John 3:16",
  explanation: "This is a test explanation for the question.",
  category: "general",
  difficulty: "easy",
  testament: "new",
  tags: [],
  isReviewed: true,
});

const players: GamePlayer[] = [
  { id: "p1", name: "One", color: "royal", avatar: "dove", isBot: false, connected: true },
  { id: "p2", name: "Two", color: "amber", avatar: "star", isBot: false, connected: true },
];

const settings = { ...DEFAULT_SETTINGS, questionCount: 3, timerSeconds: 15 as const, roundSize: 2 };
const T0 = 1_000_000;

function freshGame() {
  return createGame(settings, players, [q("q1", 0), q("q2", 1), q("q3", 2)], T0);
}

function toQuestion(state = freshGame()) {
  return gameReducer(state, { type: "COUNTDOWN_FINISHED", now: T0 + COUNTDOWN_MS });
}

describe("state machine transitions", () => {
  it("starts in countdown and moves to question", () => {
    const g = freshGame();
    expect(g.phase).toBe("countdown");
    expect(g.phaseEndsAt).toBe(T0 + COUNTDOWN_MS);
    const g2 = toQuestion(g);
    expect(g2.phase).toBe("question");
    expect(g2.questionDeadline).toBe(T0 + COUNTDOWN_MS + 15000);
  });

  it("ignores COUNTDOWN_FINISHED outside the countdown phase", () => {
    const g = toQuestion();
    expect(gameReducer(g, { type: "COUNTDOWN_FINISHED", now: T0 + 99999 })).toBe(g);
  });

  it("ignores answers in the countdown phase", () => {
    const g = freshGame();
    expect(
      gameReducer(g, { type: "SUBMIT_ANSWER", playerId: "p1", answerIndex: 0, now: T0 + 1 }),
    ).toBe(g);
  });

  it("records an answer with its response time", () => {
    const g = toQuestion();
    const start = g.questionStartedAt!;
    const g2 = gameReducer(g, {
      type: "SUBMIT_ANSWER",
      playerId: "p1",
      answerIndex: 0,
      now: start + 4000,
    });
    expect(g2.pendingAnswers.p1).toEqual({ answerIndex: 0, responseMs: 4000, submittedAt: start + 4000 });
  });

  it("prevents a player answering twice", () => {
    let g = toQuestion();
    const start = g.questionStartedAt!;
    g = gameReducer(g, { type: "SUBMIT_ANSWER", playerId: "p1", answerIndex: 0, now: start + 2000 });
    const g2 = gameReducer(g, { type: "SUBMIT_ANSWER", playerId: "p1", answerIndex: 3, now: start + 3000 });
    expect(g2).toBe(g);
    expect(g2.pendingAnswers.p1!.answerIndex).toBe(0);
  });

  it("rejects answers from unknown players and invalid indexes", () => {
    const g = toQuestion();
    const start = g.questionStartedAt!;
    expect(gameReducer(g, { type: "SUBMIT_ANSWER", playerId: "hacker", answerIndex: 0, now: start + 1 })).toBe(g);
    expect(gameReducer(g, { type: "SUBMIT_ANSWER", playerId: "p1", answerIndex: 7, now: start + 1 })).toBe(g);
  });

  it("rejects answers after the deadline plus grace", () => {
    const g = toQuestion();
    const deadline = g.questionDeadline!;
    const late = gameReducer(g, {
      type: "SUBMIT_ANSWER",
      playerId: "p1",
      answerIndex: 0,
      now: deadline + LATE_GRACE_MS + 1,
    });
    expect(late).toBe(g);
    // but within the grace window still counts (network latency)
    const okLate = gameReducer(g, {
      type: "SUBMIT_ANSWER",
      playerId: "p1",
      answerIndex: 0,
      now: deadline + LATE_GRACE_MS - 1,
    });
    expect(okLate.pendingAnswers.p1).toBeDefined();
  });

  it("shouldReveal triggers on timer expiry and on all-answered", () => {
    let g = toQuestion();
    const start = g.questionStartedAt!;
    expect(shouldReveal(g, start + 1000)).toBe(false);
    expect(shouldReveal(g, g.questionDeadline!)).toBe(true);
    g = gameReducer(g, { type: "SUBMIT_ANSWER", playerId: "p1", answerIndex: 0, now: start + 1000 });
    g = gameReducer(g, { type: "SUBMIT_ANSWER", playerId: "p2", answerIndex: 1, now: start + 2000 });
    expect(allAnswered(g)).toBe(true);
    expect(shouldReveal(g, start + 2000)).toBe(true);
  });

  it("scores at reveal: unanswered players get 0 and lose their streak", () => {
    let g = toQuestion();
    const start = g.questionStartedAt!;
    g = gameReducer(g, { type: "SUBMIT_ANSWER", playerId: "p1", answerIndex: 0, now: start + 1000 });
    g = gameReducer(g, { type: "LOCK_AND_REVEAL", now: g.questionDeadline! });
    expect(g.phase).toBe("reveal");
    expect(g.scores.p1!.score).toBeGreaterThanOrEqual(100);
    expect(g.scores.p1!.correctCount).toBe(1);
    expect(g.scores.p2!.score).toBe(0);
    expect(g.scores.p2!.answers[0]!.answerIndex).toBeNull();
  });

  it("walks reveal → round-summary → question → … → complete", () => {
    let g = toQuestion();
    const advanceThrough = (answer: number) => {
      const start = g.questionStartedAt!;
      g = gameReducer(g, { type: "SUBMIT_ANSWER", playerId: "p1", answerIndex: answer, now: start + 1000 });
      g = gameReducer(g, { type: "LOCK_AND_REVEAL", now: start + 15000 });
      g = gameReducer(g, { type: "ADVANCE", now: start + 20000 });
    };
    advanceThrough(0); // q1 done → roundSize=2 not yet
    expect(g.phase).toBe("question");
    expect(g.currentIndex).toBe(1);
    advanceThrough(1); // q2 done → end of round 1
    expect(g.phase).toBe("round-summary");
    expect(g.roundJustEnded).toBe(1);
    g = gameReducer(g, { type: "ADVANCE", now: Date.now() });
    expect(g.phase).toBe("question");
    expect(g.currentIndex).toBe(2);
    advanceThrough(2); // q3 done → complete
    expect(g.phase).toBe("complete");
    expect(g.winnerIds).toEqual(["p1"]);
  });

  it("duplicate ADVANCE requests cannot skip questions", () => {
    let g = toQuestion();
    const start = g.questionStartedAt!;
    g = gameReducer(g, { type: "LOCK_AND_REVEAL", now: start + 15000 });
    const once = gameReducer(g, { type: "ADVANCE", now: start + 20000 });
    // second ADVANCE arrives while already in "question" — must be ignored
    const twice = gameReducer(once, { type: "ADVANCE", now: start + 20001 });
    expect(twice).toBe(once);
    expect(twice.currentIndex).toBe(1);
  });
});
