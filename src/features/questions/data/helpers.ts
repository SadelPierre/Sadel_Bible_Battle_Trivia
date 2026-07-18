import type { BibleCategory, BibleQuestion, QuestionDifficulty } from "@/types/game";

type Testament = "old" | "new" | "both";

/**
 * Compact factory for seed questions. All seed content was human-reviewed for
 * this project; excerpts use the public-domain King James Version (KJV).
 */
export function makeQuestionFactory(category: BibleCategory) {
  return function q(
    id: string,
    testament: Testament,
    difficulty: QuestionDifficulty,
    question: string,
    options: [string, string, string, string],
    correctAnswerIndex: number,
    bibleReference: string,
    explanation: string,
    tags: string[] = [],
    scriptureExcerpt?: string,
  ): BibleQuestion {
    return {
      id,
      question,
      options,
      correctAnswerIndex,
      bibleReference,
      scriptureExcerpt,
      explanation,
      category,
      difficulty,
      testament,
      tags,
      sourceTranslation: scriptureExcerpt ? "KJV" : undefined,
      isReviewed: true,
    };
  };
}
