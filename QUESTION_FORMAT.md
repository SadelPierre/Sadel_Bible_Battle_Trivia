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

The bank holds **450 reviewed questions** across 15 categories, split into two
pools that never overlap:

| Pool | Files | Aggregator | Size | Used by |
| --- | --- | --- | --- | --- |
| Offline | `src/features/questions/data/offline/<category>.ts` | `offline-bank.ts` → `OFFLINE_QUESTION_BANK` | 300 (20 per category) | Solo, Local |
| Online | `src/features/questions/data/online/<category>.ts` | `bank.ts` → `ONLINE_QUESTION_BANK` (`server-only`) | 150 (10 per category) | online rooms, tournaments |

Both pools cover every category and every difficulty. The offline pool is the
larger of the two because it carries the questions that have already been
published to browsers — see "Rotating the online pool" below.

**Why the split.** Solo and Local grade answers on the device — they have to keep
working with no network — so their questions reach the browser complete with
`correctAnswerIndex`. Anyone can read them out of a JavaScript chunk. Online
snapshots go to some trouble to withhold the correct answer until reveal, and
that is pointless for any question the client already has a copy of. So a
question a browser can read never decides a competitive match.

The two pools live in separate module trees rather than being filtered out of
one array at runtime: filtering would still ship every question. `bank.ts` also
imports `server-only`, so a client importing the online pool is a build error
rather than a silent leak. `QUESTION_BANK` (both pools) exists for validation,
admin tooling and seeding only — never for choosing a live match's questions.
Unit tests assert that the pools share no id **and no question text**.

## Rotating the online pool

Splitting the bank stops future exposure; it cannot un-publish what a browser
already downloaded. Every question that was live before the split had shipped to
every visitor, so the first online pool was burned the moment it was created.

The fix is a rotation, and it is the reason the pools are uneven:

1. Move the exposed questions into `data/offline/`. They are still good
   questions, and the offline pool is public by design, so nothing is wasted.
2. Author replacements in `data/online/` that have never been in a bundle.

If the online pool is ever exposed again — an accidental client import, a
debug endpoint, a leaked build — rotate it the same way. Treat any online
question that has reached a browser as spent, whatever the route.

## Admin workflow (protected — local CLI, never exposed in the app)

```bash
npm run questions:admin -- validate          # all rules + duplicate-id + similarity detection (both pools)
npm run questions:admin -- list [category]   # list (flags UNREVIEWED)
npm run questions:admin -- preview ot-001    # see a question exactly as players will
npm run questions:admin -- stats             # category/difficulty distribution
npm run questions:admin -- export bank.json  # export to JSON
npm run questions:admin -- import new.json   # validate external questions for merging
npm run db:seed                              # upsert bank into Supabase bible_questions
```

### Adding a question

1. Open the category file in the pool you are extending — `data/offline/<category>.ts` or `data/online/<category>.ts` (or create a new one and register it in both `offline-bank.ts` and `bank.ts`). Keep the two pools balanced, and never copy a question from one into the other.
2. Add an entry with the factory `q(id, testament, difficulty, question, options, 0, reference, explanation, tags, excerpt?)` — put the correct answer **first**.
3. Run `npm run questions:admin -- validate` (also runs in `npm test`).
4. Set `isReviewed` true only after a human has checked the reference.

### Disabling a question

Remove it from its data file (or comment it out) — or, if using the database mirror, set `is_active = false` in `bible_questions`.

### Duplicate / similarity detection

`validate` compares normalized question texts (token Jaccard ≥ 0.8) and rejects duplicate ids, so near-identical questions are caught before they ship.

### Import format

`import` accepts a JSON array of `BibleQuestion` objects, validates every entry, rejects colliding ids, and prints the accepted entries ready to paste into a data file.
