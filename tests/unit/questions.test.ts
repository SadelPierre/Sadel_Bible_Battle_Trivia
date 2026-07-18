import { describe, expect, it } from "vitest";
import { QUESTION_BANK } from "@/features/questions/bank";
import { validateBank } from "@/features/questions/validate";
import { selectQuestions, withShuffledOptions } from "@/features/questions/select";
import { ALL_CATEGORIES, DEFAULT_SETTINGS } from "@/types/game";

describe("seed question bank", () => {
  it("contains at least 150 questions", () => {
    expect(QUESTION_BANK.length).toBeGreaterThanOrEqual(150);
  });

  it("covers every category with at least 8 questions", () => {
    for (const cat of ALL_CATEGORIES) {
      const count = QUESTION_BANK.filter((q) => q.category === cat).length;
      expect(count, `category ${cat}`).toBeGreaterThanOrEqual(8);
    }
  });

  it("includes every difficulty", () => {
    for (const d of ["easy", "medium", "hard"] as const) {
      expect(QUESTION_BANK.some((q) => q.difficulty === d)).toBe(true);
    }
  });

  it("passes full validation (fields, 4 distinct options, ids, similarity)", () => {
    const issues = validateBank(QUESTION_BANK);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it("every question is reviewed and has a Bible reference + explanation", () => {
    for (const q of QUESTION_BANK) {
      expect(q.isReviewed, q.id).toBe(true);
      expect(q.bibleReference.length, q.id).toBeGreaterThan(3);
      expect(q.explanation.length, q.id).toBeGreaterThan(10);
    }
  });
});

describe("question selection", () => {
  it("selects the requested count with no duplicates", () => {
    const qs = selectQuestions(QUESTION_BANK, { ...DEFAULT_SETTINGS, questionCount: 20 });
    expect(qs).toHaveLength(20);
    expect(new Set(qs.map((q) => q.id)).size).toBe(20);
  });

  it("respects category filters", () => {
    const qs = selectQuestions(QUESTION_BANK, {
      ...DEFAULT_SETTINGS,
      questionCount: 8,
      categories: ["parables"],
    });
    expect(qs.every((q) => q.category === "parables")).toBe(true);
  });

  it("respects difficulty filters", () => {
    const qs = selectQuestions(QUESTION_BANK, {
      ...DEFAULT_SETTINGS,
      questionCount: 10,
      difficulty: "easy",
    });
    expect(qs.every((q) => q.difficulty === "easy")).toBe(true);
  });

  it("avoids recently used questions when enough fresh ones remain", () => {
    const first = selectQuestions(QUESTION_BANK, { ...DEFAULT_SETTINGS, questionCount: 10 });
    const used = new Set(first.map((q) => q.id));
    const second = selectQuestions(QUESTION_BANK, { ...DEFAULT_SETTINGS, questionCount: 10 }, used);
    expect(second.some((q) => used.has(q.id))).toBe(false);
  });

  it("widens the pool instead of failing when the filter is too narrow", () => {
    const qs = selectQuestions(QUESTION_BANK, {
      ...DEFAULT_SETTINGS,
      questionCount: 30,
      categories: ["parables"],
      difficulty: "hard",
    });
    expect(qs).toHaveLength(30);
  });

  it("shuffles option positions while keeping the correct answer", () => {
    const original = QUESTION_BANK[0]!;
    const correctText = original.options[original.correctAnswerIndex];
    const positions = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const shuffled = withShuffledOptions(original);
      expect(shuffled.options[shuffled.correctAnswerIndex]).toBe(correctText);
      expect([...shuffled.options].sort()).toEqual([...original.options].sort());
      positions.add(shuffled.correctAnswerIndex);
    }
    expect(positions.size).toBeGreaterThan(1); // not always index 0
  });
});
