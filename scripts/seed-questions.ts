/**
 * Seed (upsert) the code question bank into the Supabase `bible_questions`
 * table. The game reads questions from the bundled bank at runtime, so this is
 * for admin tooling / future dynamic content.
 *
 * Usage:  npx tsx scripts/seed-questions.ts
 * Needs: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY in .env.local
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { QUESTION_BANK } from "../src/features/questions/bank";
import { validateBank } from "../src/features/questions/validate";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY (.env.local).");
    process.exit(1);
  }

  const issues = validateBank(QUESTION_BANK);
  if (issues.length > 0) {
    console.error("Question bank has validation issues — fix these first:");
    for (const issue of issues) console.error(`  [${issue.id}] ${issue.message}`);
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const rows = QUESTION_BANK.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    correct_answer_index: q.correctAnswerIndex,
    bible_reference: q.bibleReference,
    scripture_excerpt: q.scriptureExcerpt ?? null,
    explanation: q.explanation,
    category: q.category,
    difficulty: q.difficulty,
    testament: q.testament,
    tags: q.tags,
    source_translation: q.sourceTranslation ?? null,
    is_reviewed: q.isReviewed,
    is_active: true,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await db.from("bible_questions").upsert(rows);
  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
  console.log(`Seeded ${rows.length} questions into bible_questions. ✅`);
}

void main();
