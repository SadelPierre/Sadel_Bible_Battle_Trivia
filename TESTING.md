# Testing

## Commands

```bash
npm test                          # Vitest: unit + component (jsdom)
npm run test:watch                # watch mode
npm run test:integration          # Vitest: real-Postgres tests (skips without DATABASE_URL)
npx playwright install chromium   # once, before first e2e run
npm run test:e2e                  # Playwright e2e (starts the dev server itself)
npm run lint                      # ESLint
npm run typecheck                 # strict TypeScript
npm run build                     # production build
```

## What is covered

### Unit tests (`tests/unit`)

- **scoring.test.ts** — standard scoring (correct/incorrect/no answer), speed-bonus scaling and bounds, streak-bonus progression and cap, all four tie-breaker levels, shared ranks and multi-winner ties.
- **engine.test.ts** — state-machine transitions (countdown → question → reveal → round-summary → complete), answer recording with response times, one-answer-per-player, unknown-player/out-of-range rejection, deadline + grace enforcement, timer-expiry locking, unanswered scoring and streak reset, duplicate-ADVANCE protection (race-condition guard).
- **bots.test.ts** — Easy/Medium/Hard accuracy bands (40–55 / 60–75 / 80–92 % on medium questions), question-difficulty modifiers, correct/incorrect plan selection, never-instant + always-beats-timer delays, response-time variance (not hardcoded).
- **questions.test.ts** — bank ≥150, every category ≥8, all difficulties present, full Zod validation of every question, distinct options, duplicate-id and similarity detection, reference+explanation presence, selection count/filters/no-repeat/rematch-exclusion/pool-widening, per-match option shuffling, and that the offline and online pools share no question (the online answer key must never reach a browser).
- **api-auth.test.ts** — room credentials are read from the Authorization header and never from the query string, malformed headers are rejected, and rate-limit identity prefers platform-set headers over the caller-controlled first entry of `x-forwarded-for`.
- **validation.test.ts** — display-name acceptance/rejection/sanitization (including script-tag stripping), room-code generation alphabet/length, empty and invalid room codes, input normalization.

### Integration tests (`tests/integration`)

These need a real Postgres, because what they test is a property of Postgres
locking rather than of application code. They skip unless `DATABASE_URL` is set,
and CI runs them in the `migrations` job against the database it has just
migrated.

- **tournament-concurrency.test.ts** — closing a tournament question blocks on an
  in-flight answer instead of revealing without it; answers are refused once the
  question is closed; the next question stays open; a 30-player field submitting
  while the question closes loses nothing (every answer the API accepted appears
  in the reveal); a 12-tap double-tap storm still counts once.

To run them locally:

```bash
docker run -d --name bbl-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:15
docker cp supabase bbl-pg:/tmp/supabase
docker exec bbl-pg psql -U postgres -f /tmp/supabase/ci/bootstrap.sql
for f in supabase/migrations/*.sql; do
  docker exec bbl-pg psql -U postgres -v ON_ERROR_STOP=1 -f "/tmp/$f"
done
DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres npm run test:integration
```

The suite was validated by reverting `close_tournament_question` to its
pre-fix lock-free form: three of the five tests fail, including one that catches
a genuinely dropped answer. A concurrency test that cannot fail is worth nothing.

### Component tests (`tests/component`)

AnswerButton (render, select, disabled, reveal states), Scoreboard (ranks, scores, answered/thinking status), RevealPanel (correct answer, Bible reference, explanation, per-player results incl. "no answer"), QuestionHeader (number/category/difficulty/timer), FinalResults (winner announcement, tie announcement, leaderboard).

### End-to-end tests (`tests/e2e`)

- Complete a 5-question solo game vs 2 bots through countdown, questions, reveals (Bible reference visible), round summary, and final results with Rematch.
- Invalid room-code error handling.
- Two-player local shared-screen game start with per-player answer rows.
- A `mobile` Playwright project (Pixel 7 viewport) is configured: `npx playwright test --project=mobile`.

Online-multiplayer e2e (create/join/start/answer across two browser contexts, reconnect, host migration, full room, rematch) requires live Supabase credentials in `.env.local`; with them configured the same flows can be exercised manually in two incognito windows — see the checklist below.

## Manual online checklist (needs Supabase configured)

1. Window A: create a room → lobby shows the code and you as 👑 host.
2. Window B (incognito): join by code → both lobbies update in real time.
3. B refreshes → rejoins the same seat (reconnect).
4. A adds a Hard bot, changes settings → B sees them read-only.
5. B presses Ready; A starts → synchronized countdown and timers.
6. Both answer; ✅ marks appear without revealing choices; reveal shows reference + explanation; scores animate.
7. A closes their tab mid-game → within ~45 s B becomes host and can Continue.
8. Finish → final results; host Rematch starts a new match avoiding recent questions.
9. Fifth join attempt on a full room → "This room is full."
10. Join with a made-up code → "Room not found."

## Status of the last full run

`npm test` (77 tests), `npm run test:integration` (5 tests, against Postgres 15), `npm run lint`, `npm run typecheck`, and `npm run build` all pass. The Playwright server startup is verified for both desktop and mobile projects. A complete browser run still requires the one-time Chromium download described above; if a restricted environment blocks the Playwright CDN, run it locally or in CI with browser downloads enabled.
