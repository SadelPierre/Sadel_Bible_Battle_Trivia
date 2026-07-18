# Question Format & Content Workflow

## Schema

Every question conforms to `BibleQuestion` (`src/types/game.ts`), validated by the Zod schema in `src/features/questions/validate.ts`:

```ts
type BibleQuestion = {
  id: string;                        // unique, e.g. "ot-011"
  question: string;                  // 8–300 chars
  options: [string, string, string, string]; // exactly 4, all distinct
  correctAnswerIndex: number;        // 0–3 (seed data uses 0; positions are shuffled per match)
  bibleReference: string;            // must support the correct answer, e.g. "Genesis 6:13-22"
  scriptureExcerpt?: string;         // brief, public-domain (KJV)
  explanation: string;               // 1–3 sentences, 10–500 chars
  category: BibleCategory;           // one of the 15 categories
  difficulty: "easy" | "medium" | "hard";
  testament: "old" | "new" | "both";
  tags: string[];
  sourceTranslation?: string;        // "KJV" when an excerpt is present
  isReviewed: boolean;               // only reviewed questions ship
};
```

Content rules enforced by review + validation:

- Exactly one unambiguous correct answer; distractors plausible, never mocking.
- The Bible reference must genuinely support the answer — never invent verses.
- Scripture excerpts use the public-domain **KJV** (configurable via `sourceTranslation`; the WEB is another good public-domain option).
- Avoid denominationally controversial wording.
- Family-friendly tone throughout.

**Answer-position security:** seed files store the correct answer at index 0 for easy review; `withShuffledOptions` re-shuffles positions for every match, so players can never learn a pattern (a unit test asserts this).

## Where questions live

`src/features/questions/data/<category>.ts` — one file per category, aggregated by `bank.ts`. The seed bank ships **150 reviewed questions** (10 per category × 15 categories).

## Admin workflow (protected — local CLI, never exposed in the app)

```bash
npm run questions:admin -- validate          # all rules + duplicate-id + similarity detection
npm run questions:admin -- list [category]   # list (flags UNREVIEWED)
npm run questions:admin -- preview ot-001    # see a question exactly as players will
npm run questions:admin -- stats             # category/difficulty distribution
npm run questions:admin -- export bank.json  # export to JSON
npm run questions:admin -- import new.json   # validate external questions for merging
npm run db:seed                              # upsert bank into Supabase bible_questions
```

### Adding a question

1. Open the category file (or create a new one and register it in `bank.ts`).
2. Add an entry with the factory `q(id, testament, difficulty, question, options, 0, reference, explanation, tags, excerpt?)` — put the correct answer **first**.
3. Run `npm run questions:admin -- validate` (also runs in `npm test`).
4. Set `isReviewed` true only after a human has checked the reference.

### Disabling a question

Remove it from its data file (or comment it out) — or, if using the database mirror, set `is_active = false` in `bible_questions`.

### Duplicate / similarity detection

`validate` compares normalized question texts (token Jaccard ≥ 0.8) and rejects duplicate ids, so near-identical questions are caught before they ship.

### Import format

`import` accepts a JSON array of `BibleQuestion` objects, validates every entry, rejects colliding ids, and prints the accepted entries ready to paste into a data file.
