# Testing

## Commands

```bash
npm test                          # Vitest: unit + component (jsdom)
npm run test:watch                # watch mode
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
- **questions.test.ts** — bank ≥150, every category ≥8, all difficulties present, full Zod validation of every question, distinct options, duplicate-id and similarity detection, reference+explanation presence, selection count/filters/no-repeat/rematch-exclusion/pool-widening, per-match option shuffling.
- **validation.test.ts** — display-name acceptance/rejection/sanitization (including script-tag stripping), room-code generation alphabet/length, empty and invalid room codes, input normalization.

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

`npm test` (58 tests), `npm run lint`, `npm run typecheck`, and `npm run build` all pass. The Playwright server startup is verified for both desktop and mobile projects. A complete browser run still requires the one-time Chromium download described above; if a restricted environment blocks the Playwright CDN, run it locally or in CI with browser downloads enabled.
