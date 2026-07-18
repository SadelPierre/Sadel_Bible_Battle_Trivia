import { z } from "zod";
import { ALL_CATEGORIES, type BibleQuestion } from "@/types/game";

export const bibleQuestionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(8).max(300),
    options: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1), z.string().min(1)]),
    correctAnswerIndex: z.number().int().min(0).max(3),
    bibleReference: z.string().min(3),
    scriptureExcerpt: z.string().max(400).optional(),
    explanation: z.string().min(10).max(500),
    category: z.enum(ALL_CATEGORIES as [string, ...string[]]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    testament: z.enum(["old", "new", "both"]),
    tags: z.array(z.string()),
    sourceTranslation: z.string().optional(),
    isReviewed: z.boolean(),
  })
  .refine((q) => new Set(q.options.map((o) => o.trim().toLowerCase())).size === 4, {
    message: "options must be four distinct answers",
  });

export type QuestionIssue = { id: string; message: string };

export function validateQuestion(q: unknown): QuestionIssue[] {
  const result = bibleQuestionSchema.safeParse(q);
  if (result.success) return [];
  const id =
    typeof q === "object" && q !== null && "id" in q ? String((q as { id: unknown }).id) : "?";
  return result.error.issues.map((issue) => ({
    id,
    message: `${issue.path.join(".")}: ${issue.message}`,
  }));
}

export function validateBank(questions: BibleQuestion[]): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  const seenIds = new Set<string>();
  for (const q of questions) {
    issues.push(...validateQuestion(q));
    if (seenIds.has(q.id)) issues.push({ id: q.id, message: "duplicate question id" });
    seenIds.add(q.id);
  }
  issues.push(
    ...findSimilarQuestions(questions).map(([a, b]) => ({
      id: a,
      message: `very similar to question ${b}`,
    })),
  );
  return issues;
}

/** normalize for similarity detection */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect duplicate or highly similar question texts (token Jaccard ≥ 0.8). */
export function findSimilarQuestions(questions: BibleQuestion[]): [string, string][] {
  const pairs: [string, string][] = [];
  const tokens = questions.map((q) => new Set(norm(q.question).split(" ")));
  for (let i = 0; i < questions.length; i++) {
    for (let j = i + 1; j < questions.length; j++) {
      const a = tokens[i]!;
      const b = tokens[j]!;
      let inter = 0;
      for (const t of a) if (b.has(t)) inter++;
      const union = a.size + b.size - inter;
      if (union > 0 && inter / union >= 0.8) {
        pairs.push([questions[i]!.id, questions[j]!.id]);
      }
    }
  }
  return pairs;
}
