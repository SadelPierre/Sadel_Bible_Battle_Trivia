import type { BibleCategory, BibleQuestion, GameSettings } from "@/types/game";
import type { Rng } from "@/features/computer-players/bots";

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Seed data always stores the correct answer at index 0; shuffling per match
 * means players can never learn a position pattern.
 */
export function withShuffledOptions(question: BibleQuestion, rng: Rng = Math.random): BibleQuestion {
  const order = shuffle([0, 1, 2, 3], rng);
  const options = order.map((i) => question.options[i]!) as [string, string, string, string];
  return {
    ...question,
    options,
    correctAnswerIndex: order.indexOf(question.correctAnswerIndex),
  };
}

/**
 * Select questions for a match.
 * - Filters by category and difficulty settings.
 * - Never repeats a question within the match.
 * - `excludeIds` (recently used questions, e.g. the previous match in a rematch)
 *   are avoided while enough fresh questions remain.
 * - Falls back to widening the pool rather than failing when filters are too narrow.
 */
export function selectQuestions(
  bank: BibleQuestion[],
  settings: GameSettings,
  excludeIds: Set<string> = new Set(),
  rng: Rng = Math.random,
): BibleQuestion[] {
  const wantCategories: BibleCategory[] | null =
    settings.categories === "mixed" ? null : settings.categories;

  const matches = (q: BibleQuestion, useCategory: boolean, useDifficulty: boolean) =>
    (!useCategory || !wantCategories || wantCategories.includes(q.category)) &&
    (!useDifficulty || settings.difficulty === "mixed" || q.difficulty === settings.difficulty);

  // pool tiers, strictest first; each tier splits into fresh vs recently used
  const tiers: BibleQuestion[][] = [
    bank.filter((q) => matches(q, true, true) && !excludeIds.has(q.id)),
    bank.filter((q) => matches(q, true, true) && excludeIds.has(q.id)),
    bank.filter((q) => matches(q, true, false) && !excludeIds.has(q.id)),
    bank.filter((q) => matches(q, false, false) && !excludeIds.has(q.id)),
    bank,
  ];

  const chosen: BibleQuestion[] = [];
  const chosenIds = new Set<string>();
  for (const tier of tiers) {
    if (chosen.length >= settings.questionCount) break;
    for (const q of shuffle(tier, rng)) {
      if (chosen.length >= settings.questionCount) break;
      if (chosenIds.has(q.id)) continue;
      chosen.push(q);
      chosenIds.add(q.id);
    }
  }
  return chosen.slice(0, settings.questionCount).map((q) => withShuffledOptions(q, rng));
}
