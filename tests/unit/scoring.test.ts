import { describe, expect, it } from "vitest";
import {
  BASE_POINTS,
  MAX_SPEED_BONUS,
  rankPlayers,
  scoreAnswer,
  speedBonus,
  streakBonus,
  winners,
} from "@/features/scoring/scoring";
import type { GamePlayer, PlayerScoreState } from "@/types/game";

const player = (id: string): GamePlayer => ({
  id,
  name: id,
  color: "royal",
  avatar: "dove",
  isBot: false,
  connected: true,
});

const score = (overrides: Partial<PlayerScoreState>): PlayerScoreState => ({
  score: 0,
  correctCount: 0,
  streak: 0,
  bestStreak: 0,
  correctResponseMsTotal: 0,
  answers: [],
  ...overrides,
});

describe("standard scoring", () => {
  it("awards 100 for a correct answer", () => {
    const r = scoreAnswer({
      answerIndex: 2,
      responseMs: 5000,
      correctAnswerIndex: 2,
      timerMs: 15000,
      currentStreak: 0,
      style: "standard",
    });
    expect(r.isCorrect).toBe(true);
    expect(r.totalPoints).toBe(BASE_POINTS);
    expect(r.speedBonus).toBe(0);
    expect(r.streakBonus).toBe(0);
  });

  it("awards 0 for an incorrect answer", () => {
    const r = scoreAnswer({
      answerIndex: 1,
      responseMs: 5000,
      correctAnswerIndex: 2,
      timerMs: 15000,
      currentStreak: 3,
      style: "speed+streak",
    });
    expect(r.isCorrect).toBe(false);
    expect(r.totalPoints).toBe(0);
  });

  it("awards 0 for no answer", () => {
    const r = scoreAnswer({
      answerIndex: null,
      responseMs: null,
      correctAnswerIndex: 2,
      timerMs: 15000,
      currentStreak: 5,
      style: "speed+streak",
    });
    expect(r.isCorrect).toBe(false);
    expect(r.totalPoints).toBe(0);
  });
});

describe("speed bonus", () => {
  it("gives max bonus for an instant answer", () => {
    expect(speedBonus(0, 15000)).toBe(MAX_SPEED_BONUS);
  });
  it("gives 0 bonus when the timer is used up", () => {
    expect(speedBonus(15000, 15000)).toBe(0);
  });
  it("scales linearly", () => {
    expect(speedBonus(7500, 15000)).toBe(MAX_SPEED_BONUS / 2);
  });
  it("is included in speed-style scoring", () => {
    const r = scoreAnswer({
      answerIndex: 0,
      responseMs: 0,
      correctAnswerIndex: 0,
      timerMs: 10000,
      currentStreak: 0,
      style: "speed",
    });
    expect(r.totalPoints).toBe(BASE_POINTS + MAX_SPEED_BONUS);
  });
});

describe("streak bonus", () => {
  it("no bonus for the first correct answer", () => {
    expect(streakBonus(1)).toBe(0);
  });
  it("increases with streak length", () => {
    expect(streakBonus(2)).toBe(10);
    expect(streakBonus(3)).toBe(20);
    expect(streakBonus(4)).toBe(30);
  });
  it("caps at 50", () => {
    expect(streakBonus(10)).toBe(50);
    expect(streakBonus(100)).toBe(50);
  });
});

describe("tie-breaking", () => {
  it("ranks by score first", () => {
    const ranked = rankPlayers([player("a"), player("b")], {
      a: score({ score: 100 }),
      b: score({ score: 300 }),
    });
    expect(ranked[0]!.player.id).toBe("b");
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[1]!.rank).toBe(2);
  });

  it("breaks score ties by correct count", () => {
    const ranked = rankPlayers([player("a"), player("b")], {
      a: score({ score: 300, correctCount: 3 }),
      b: score({ score: 300, correctCount: 2 }),
    });
    expect(ranked[0]!.player.id).toBe("a");
  });

  it("breaks remaining ties by average correct response time", () => {
    const ranked = rankPlayers([player("slow"), player("fast")], {
      slow: score({ score: 300, correctCount: 3, correctResponseMsTotal: 15000 }),
      fast: score({ score: 300, correctCount: 3, correctResponseMsTotal: 9000 }),
    });
    expect(ranked[0]!.player.id).toBe("fast");
  });

  it("shares the rank when fully tied, and both are winners", () => {
    const ranked = rankPlayers([player("a"), player("b"), player("c")], {
      a: score({ score: 300, correctCount: 3, correctResponseMsTotal: 9000 }),
      b: score({ score: 300, correctCount: 3, correctResponseMsTotal: 9000 }),
      c: score({ score: 100, correctCount: 1 }),
    });
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[1]!.rank).toBe(1);
    expect(ranked[2]!.rank).toBe(3);
    expect(winners(ranked).sort()).toEqual(["a", "b"]);
  });
});
