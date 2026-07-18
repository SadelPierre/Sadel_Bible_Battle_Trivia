/**
 * Computer opponents. A bot "plans" its answer the moment a question starts:
 * whether it will be correct, which wrong option it picks otherwise, and how
 * long it "thinks". Randomness is injectable for deterministic tests.
 *
 * Offline the plan is executed with setTimeout; online the server stores the
 * plan's timestamp and applies it once authoritative time passes it.
 */
import type { BibleQuestion, BotDifficulty, QuestionDifficulty } from "@/types/game";

export type Rng = () => number; // [0, 1)

export type BotPlan = {
  answerIndex: number;
  /** ms after the question starts at which the bot submits */
  delayMs: number;
};

type Profile = {
  /** base accuracy range on a medium question */
  accuracy: [number, number];
  /** think-time range as a fraction of the question timer */
  delayFraction: [number, number];
};

const PROFILES: Record<BotDifficulty, Profile> = {
  easy: { accuracy: [0.4, 0.55], delayFraction: [0.45, 0.95] },
  medium: { accuracy: [0.6, 0.75], delayFraction: [0.3, 0.85] },
  hard: { accuracy: [0.8, 0.92], delayFraction: [0.15, 0.6] },
};

/** harder questions make every bot a bit less accurate; easier ones a bit more */
const QUESTION_DIFFICULTY_MODIFIER: Record<QuestionDifficulty, number> = {
  easy: 0.06,
  medium: 0,
  hard: -0.08,
};

function lerp(range: [number, number], t: number): number {
  return range[0] + (range[1] - range[0]) * t;
}

export function botAccuracy(
  bot: BotDifficulty,
  question: QuestionDifficulty,
  rng: Rng = Math.random,
): number {
  const base = lerp(PROFILES[bot].accuracy, rng());
  return Math.min(0.98, Math.max(0.05, base + QUESTION_DIFFICULTY_MODIFIER[question]));
}

export function planBotAnswer(
  bot: BotDifficulty,
  question: BibleQuestion,
  timerMs: number,
  rng: Rng = Math.random,
): BotPlan {
  const correct = rng() < botAccuracy(bot, question.difficulty, rng);
  let answerIndex: number;
  if (correct) {
    answerIndex = question.correctAnswerIndex;
  } else {
    // pick a believable wrong option uniformly among the three distractors
    const wrong = [0, 1, 2, 3].filter((i) => i !== question.correctAnswerIndex);
    answerIndex = wrong[Math.floor(rng() * wrong.length)] ?? 0;
  }
  const delayMs = Math.round(lerp(PROFILES[bot].delayFraction, rng()) * timerMs);
  // never answer in the first 800ms (looks robotic) and always beat the buzzer
  return {
    answerIndex,
    delayMs: Math.min(Math.max(delayMs, 800), Math.max(1000, timerMs - 500)),
  };
}

export const BOT_NAMES = [
  "Deborah Bot",
  "Barnabas Bot",
  "Lydia Bot",
  "Silas Bot",
  "Priscilla Bot",
  "Apollos Bot",
] as const;

export function botName(index: number): string {
  return BOT_NAMES[index % BOT_NAMES.length] ?? `Bot ${index + 1}`;
}
