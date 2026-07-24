# Architecture

## WAT framework

**Workflow** — the development workflow (inspect → plan → schema → engine → modes → polish → test → document) is tracked in this repo's docs; the player and online workflows are described in GAME_RULES.md and implemented by the state machine below.

**Agents** — implemented as clearly separated responsibilities, one module per concern:

| Agent | Where it lives |
| --- | --- |
| Architecture | this document; `src/features/*` boundaries |
| Bible Content | `src/features/questions/data/*` + `validate.ts` (Zod schema, duplicate/similarity detection) |
| Gameplay | `src/features/game-engine/engine.ts` (pure state machine) + `src/features/scoring/scoring.ts` |
| Computer Player | `src/features/computer-players/bots.ts` |
| Multiplayer | `src/features/online/server.ts` (authoritative), `client.ts`, `src/hooks/useOnlineRoom.ts` |
| UI/UX | `src/components/*`, `src/app/*` |
| Animation & Audio | Framer Motion throughout; `src/features/audio/audio.ts` |
| Testing | `tests/unit`, `tests/component`, `tests/e2e` |
| Security | RLS in `supabase/migrations`, `src/lib/validation.ts`, `src/lib/rateLimit.ts`, snapshot sanitization |
| Project Manager | task checklist + acceptance criteria in README/TESTING |

**Tools** — Next.js 15 App Router, TypeScript strict, Tailwind v4, Framer Motion, Zustand, Zod, Supabase (Postgres + Realtime), Vitest + React Testing Library + Playwright, ESLint + Prettier, Vercel.

Documented stack deviations (per spec rule 17):
- **shadcn/ui → hand-rolled Tailwind components.** The game needs ~10 bespoke, heavily themed components (answer buttons, timer ring, scoreboards); a generated component library added setup weight without covering these. All components keep shadcn-style accessibility (roles, focus rings, aria labels).
- **React Hook Form → controlled inputs + Zod.** The only forms are a name field and pill selectors; RHF would be dead weight. Zod still validates on both client and server.
- **Howler.js → plain Web Audio API.** Requirements (synthesized placeholder cues, per-cue throttle, separate music/SFX buses) fit a 200-line manager with zero dependencies and no audio assets to license.

## One engine, three modes

`src/features/game-engine/engine.ts` is a **pure reducer** over `GameState` — no timers, no I/O, time passed in as epoch ms:

```
countdown → question → reveal → (round-summary) → question … → complete
```

Actions: `COUNTDOWN_FINISHED`, `SUBMIT_ANSWER`, `LOCK_AND_REVEAL`, `ADVANCE`. Invalid actions for the current phase return the state unchanged, which makes duplicate/racing requests harmless by construction.

- **Solo/local:** `src/stores/offlineGame.ts` (Zustand) drives the reducer with real `setInterval`/`setTimeout`, schedules bot answers, and handles pass-and-play turn gating (per-turn timers are mapped onto the engine's single question clock by submitting with an adjusted `now`).
- **Online:** the SAME reducer runs inside API routes. State persists in Postgres (`games.state` jsonb); browsers only ever receive sanitized snapshots.

## Online authority model

```
Browser ──POST /api/rooms/[code]/answer──▶ Next.js route (service role)
   ▲                                          │ load room+game → settle clock →
   │                                          │ apply action → atomic commit RPC
   │                                          ▼
   └──GET state ◀── sanitized snapshot     Postgres
              ▲                               │ insert game_events row
              └── Supabase Realtime ◀─────────┘  ("something changed — refetch")
```

- **Settle-on-request:** serverless functions can't run timers, so every request first advances any due transitions (countdown finished, due bot answers, timer expiry, reveal auto-advance). Clients poll every 2 s during play (4 s in lobby) with realtime nudges for instant feel, so transitions land within ~1 s of schedule.
- **Sanitization:** while a question is live, the snapshot strips `correctAnswerIndex`, `explanation`, `bibleReference`, and `scriptureExcerpt`, and exposes only *who* answered — never what they chose. Reveal-phase snapshots include everything.
- **Concurrency:** `game_rooms.version` is an optimistic lock. The `commit_room_state` database function checks and bumps it in the same transaction that writes game state, answer audits, host flags, and the sync event. Losers reload and retry (max 4 attempts); duplicate answers/advances are also reducer no-ops.
- **Bots online:** when a question starts the server rolls each bot's plan (answer + timestamp); plans apply once authoritative time passes them, so all clients see bots answer at the same moment.
- **Clocks:** snapshots carry `serverNow`; clients render countdowns as `serverDeadline − measuredOffset`. The server accepts answers up to 750 ms past the deadline to absorb latency.
- **Identity:** guests get a localStorage session id; joining a room issues a per-room `token` (returned once, stored client-side). Every API call proves `playerId + token`. Reconnection = rejoining with the same session id.
- **Host migration:** if the host's heartbeat is >45 s stale, the longest-connected human inherits the crown; a room with no humans becomes `abandoned`. Rooms expire after 24 h.

## Tournament mode

A 30-player survival knockout built as a **thin layer on top of the same engine**, not a parallel system.

- **Engine** (`src/features/tournament/tournament.ts`): the reducer delegates here whenever `GameState.tournament` is present. After each reveal the surviving pack is ranked by cumulative score and cut to a **survivor schedule** (`buildSurvivorSchedule`: 30→18→11→7→5→3→2), deterministic down to a stable player-id tiebreak so the field always converges to two finalists. The last two play a sudden-death **duel** (`DUEL_WINS_TO_WIN` outright question-wins). Eliminated players are rejected by `SUBMIT_ANSWER` and skipped by `allAnswered`, so the round never waits on them.
- **The answer inbox** (the one scaling change): the standard online path routes every answer through the room's optimistic-version lock, which is fine for 4 players but melts down when 30 people answer inside the same 2-second window. Tournament answers instead write to `tournament_answers` — one row per `(game, question, player)`, distinct primary keys, **zero contention on `game_rooms.version`** — via `submit_tournament_answer` (idempotent, first answer wins, emits a Realtime nudge). The authoritative settle pass drains the inbox (`drain_tournament_answers`) and folds all pending answers into engine state in a **single batched commit** at reveal. The write path never bumps the version; the fold path bumps it once per batch.
- **Lobby & start:** tournaments seat up to 30 (`game_rooms.max_players` relaxed to 30, `game_mode = 'tournament'`) and start on a **minimum headcount** rather than an all-Ready gate.
- **UI:** `TournamentLobby`, `TournamentGameView` (field + duel + spectator), `TournamentStandings`, `DuelPanel`, and `ChampionResult` — the room page branches on `snapshot.gameMode`. Everything else (reconnection, host migration, bots, sanitization, realtime nudges) is inherited unchanged.

## Theming

`<html data-theme="royal-bible">` selects a block of CSS custom properties in `globals.css`, which Tailwind v4 maps to utility colors via `@theme inline`. To add a theme: add tokens to `src/lib/themes.ts`, add a `[data-theme="…"]` block, switch the attribute.

## Directory map

```
src/
  app/                  routes: /, /how-to-play, /play/solo, /play/local,
                        /online, /room/[code], /api/rooms/**
  components/           game/ lobby/ results/ settings/ shared/
  features/             audio/ computer-players/ game-engine/ online/ questions/ scoring/
  hooks/                useOnlineRoom
  lib/                  branding, themes, playerColors, validation, session,
                        rateLimit, supabase/{admin,browser}
  stores/               preferences (persisted), offlineGame
  types/                game.ts (single source of truth for shared types)
supabase/migrations/    0001_init.sql (schema + RLS + realtime)
scripts/                questions-admin.ts, seed-questions.ts
tests/                  unit/ component/ e2e/ stubs/
```
