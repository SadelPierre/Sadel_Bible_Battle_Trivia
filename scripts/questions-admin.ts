/**
 * Protected question-management CLI (runs locally with your service key — it is
 * never exposed in the app). See QUESTION_FORMAT.md.
 *
 * Commands:
 *   npx tsx scripts/questions-admin.ts validate            — validate the bank (fields, dupes, similarity)
 *   npx tsx scripts/questions-admin.ts list [category]     — list questions
 *   npx tsx scripts/questions-admin.ts preview <id>        — preview one question like players see it
 *   npx tsx scripts/questions-admin.ts export <file.json>  — export the bank to JSON
 *   npx tsx scripts/questions-admin.ts import <file.json>  — validate + merge external questions (prints TS to paste)
 *   npx tsx scripts/questions-admin.ts stats               — category/difficulty distribution
 */
import { readFileSync, writeFileSync } from "fs";
import { QUESTION_BANK } from "../src/features/questions/bank";
import { validateBank, validateQuestion } from "../src/features/questions/validate";
import { CATEGORY_LABELS, type BibleQuestion } from "../src/types/game";

const [, , command, arg] = process.argv;

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

switch (command) {
  case "validate": {
    const issues = validateBank(QUESTION_BANK);
    if (issues.length === 0) {
      console.log(`✅ ${QUESTION_BANK.length} questions — no issues found.`);
    } else {
      for (const issue of issues) console.error(`[${issue.id}] ${issue.message}`);
      fail(`❌ ${issues.length} issue(s).`);
    }
    break;
  }

  case "list": {
    const list = arg ? QUESTION_BANK.filter((q) => q.category === arg) : QUESTION_BANK;
    for (const q of list) {
      console.log(`${q.id}  [${q.category}/${q.difficulty}]${q.isReviewed ? "" : "  (UNREVIEWED)"}  ${q.question}`);
    }
    console.log(`— ${list.length} questions`);
    break;
  }

  case "preview": {
    const q = QUESTION_BANK.find((x) => x.id === arg);
    if (!q) fail(`No question with id ${arg}`);
    console.log(`\n${q.question}\n`);
    q.options.forEach((o, i) =>
      console.log(`  ${"ABCD"[i]}) ${o}${i === q.correctAnswerIndex ? "   ← correct" : ""}`),
    );
    console.log(`\n📖 ${q.bibleReference}`);
    console.log(q.explanation);
    if (q.scriptureExcerpt) console.log(`“${q.scriptureExcerpt}” (${q.sourceTranslation})`);
    break;
  }

  case "export": {
    if (!arg) fail("Usage: export <file.json>");
    writeFileSync(arg, JSON.stringify(QUESTION_BANK, null, 2));
    console.log(`Exported ${QUESTION_BANK.length} questions to ${arg}`);
    break;
  }

  case "import": {
    if (!arg) fail("Usage: import <file.json>");
    const incoming = JSON.parse(readFileSync(arg, "utf8")) as unknown[];
    if (!Array.isArray(incoming)) fail("File must contain a JSON array of questions.");
    let bad = 0;
    const existingIds = new Set(QUESTION_BANK.map((q) => q.id));
    const accepted: BibleQuestion[] = [];
    for (const raw of incoming) {
      const issues = validateQuestion(raw);
      if (issues.length > 0) {
        bad++;
        for (const issue of issues) console.error(`  [${issue.id}] ${issue.message}`);
        continue;
      }
      const q = raw as BibleQuestion;
      if (existingIds.has(q.id)) {
        console.error(`  [${q.id}] id already exists in the bank — skipped`);
        bad++;
        continue;
      }
      accepted.push(q);
    }
    console.log(`\n${accepted.length} valid new question(s), ${bad} rejected.`);
    if (accepted.length > 0) {
      console.log("\nAdd these to a file in src/features/questions/data/ :\n");
      console.log(JSON.stringify(accepted, null, 2));
    }
    break;
  }

  case "stats": {
    const byCat = new Map<string, number>();
    const byDiff = new Map<string, number>();
    for (const q of QUESTION_BANK) {
      byCat.set(q.category, (byCat.get(q.category) ?? 0) + 1);
      byDiff.set(q.difficulty, (byDiff.get(q.difficulty) ?? 0) + 1);
    }
    console.log(`Total: ${QUESTION_BANK.length}\n\nBy category:`);
    for (const [cat, n] of byCat) {
      console.log(`  ${CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}: ${n}`);
    }
    console.log("\nBy difficulty:");
    for (const [d, n] of byDiff) console.log(`  ${d}: ${n}`);
    break;
  }

  default:
    fail("Commands: validate | list [category] | preview <id> | export <file> | import <file> | stats");
}
