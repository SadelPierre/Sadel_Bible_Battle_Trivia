import { describe, expect, it } from "vitest";
import { botAccuracy, planBotAnswer } from "@/features/computer-players/bots";
import type { BibleQuestion } from "@/types/game";

const question: BibleQuestion = {
  id: "t1",
  question: "A test question for the bots to answer?",
  options: ["A", "B", "C", "D"],
  correctAnswerIndex: 2,
  bibleReference: "Genesis 1:1",
  explanation: "Testing explanation of sufficient length.",
  category: "general",
  difficulty: "medium",
  testament: "old",
  tags: [],
  isReviewed: true,
};

/** deterministic rng cycling through provided values */
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("bot accuracy", () => {
  it("stays within each difficulty's configured band on medium questions", () => {
    for (let t = 0; t <= 10; t++) {
      const rng = () => t / 10;
      expect(botAccuracy("easy", "medium", rng)).toBeGreaterThanOrEqual(0.4);
      expect(botAccuracy("easy", "medium", rng)).toBeLessThanOrEqual(0.55);
      expect(botAccuracy("medium", "medium", rng)).toBeGreaterThanOrEqual(0.6);
      expect(botAccuracy("medium", "medium", rng)).toBeLessThanOrEqual(0.75);
      expect(botAccuracy("hard", "medium", rng)).toBeGreaterThanOrEqual(0.8);
      expect(botAccuracy("hard", "medium", rng)).toBeLessThanOrEqual(0.92);
    }
  });

  it("hard questions reduce accuracy; easy questions raise it", () => {
    const rng = () => 0.5;
    expect(botAccuracy("medium", "hard", rng)).toBeLessThan(botAccuracy("medium", "medium", rng));
    expect(botAccuracy("medium", "easy", rng)).toBeGreaterThan(botAccuracy("medium", "medium", rng));
  });
});

describe("bot answer plans", () => {
  it("answers correctly when the accuracy roll succeeds", () => {
    const plan = planBotAnswer("hard", question, 15000, seq(0.01, 0.5, 0.5));
    expect(plan.answerIndex).toBe(question.correctAnswerIndex);
  });

  it("picks a wrong option when the roll fails", () => {
    const plan = planBotAnswer("easy", question, 15000, seq(0.99, 0.5, 0.5, 0.5));
    expect(plan.answerIndex).not.toBe(question.correctAnswerIndex);
    expect(plan.answerIndex).toBeGreaterThanOrEqual(0);
    expect(plan.answerIndex).toBeLessThanOrEqual(3);
  });

  it("never answers instantly and always beats the timer", () => {
    for (let i = 0; i < 200; i++) {
      const plan = planBotAnswer("hard", question, 15000);
      expect(plan.delayMs).toBeGreaterThanOrEqual(800);
      expect(plan.delayMs).toBeLessThanOrEqual(14500);
    }
  });

  it("varies its response times (not hardcoded)", () => {
    const delays = new Set<number>();
    for (let i = 0; i < 50; i++) delays.add(planBotAnswer("medium", question, 15000).delayMs);
    expect(delays.size).toBeGreaterThan(10);
  });
});
