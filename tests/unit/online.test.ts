import { describe, expect, it } from "vitest";
import { createGame, gameReducer, LATE_GRACE_MS } from "@/features/game-engine/engine";
import { shouldRevealOnline } from "@/features/online/server";
import type { BibleQuestion, GamePlayer, GameSettings } from "@/types/game";

const settings: GameSettings = {
  questionCount: 1,
  timerSeconds: 10,
  difficulty: "mixed",
  categories: "mixed",
  scoringStyle: "speed",
  roundSize: 5,
  revealSeconds: 8,
};

const question: BibleQuestion = {
  id: "grace-window-test",
  question: "Who built the ark?",
  options: ["Noah", "Moses", "David", "Peter"],
  correctAnswerIndex: 0,
  bibleReference: "Genesis 6:14",
  explanation: "God instructed Noah to build the ark.",
  category: "old-testament",
  difficulty: "easy",
  testament: "old",
  tags: ["noah"],
  isReviewed: true,
};

const players: GamePlayer[] = [
  {
    id: "player-1",
    name: "Grace",
    avatar: "dove",
    color: "royal",
    isBot: false,
    connected: true,
  },
  {
    id: "player-2",
    name: "Faith",
    avatar: "lamp",
    color: "crimson",
    isBot: false,
    connected: true,
  },
];

describe("online deadline settlement", () => {
  it("keeps the question open throughout the advertised network grace window", () => {
    const started = gameReducer(createGame(settings, players, [question], 0), {
      type: "COUNTDOWN_FINISHED",
      now: 3_000,
    });
    const deadline = started.questionDeadline!;

    expect(shouldRevealOnline(started, deadline)).toBe(false);
    expect(shouldRevealOnline(started, deadline + LATE_GRACE_MS - 1)).toBe(false);
    expect(shouldRevealOnline(started, deadline + LATE_GRACE_MS)).toBe(true);
  });

  it("reveals immediately once every eligible player has answered", () => {
    let state = gameReducer(createGame(settings, players, [question], 0), {
      type: "COUNTDOWN_FINISHED",
      now: 3_000,
    });
    state = gameReducer(state, {
      type: "SUBMIT_ANSWER",
      playerId: "player-1",
      answerIndex: 0,
      now: 4_000,
    });
    state = gameReducer(state, {
      type: "SUBMIT_ANSWER",
      playerId: "player-2",
      answerIndex: 1,
      now: 4_500,
    });

    expect(shouldRevealOnline(state, 4_500)).toBe(true);
  });
});
