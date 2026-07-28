# Database

Run every file in `supabase/migrations/`, in filename order — `npx supabase db push` does this for you. The chain is replayable against a blank database; see SETUP.md §5 for the by-hand route.

## Tables

| Table | Purpose |
| --- | --- |
| `game_rooms` | one row per room: `room_code` (unique 5-letter), `host_player_id`, `status` (lobby/playing/complete/abandoned), `max_players`, `settings` jsonb, `current_game_id`, `version` (optimistic lock), `expires_at` (24 h) |
| `room_players` | seats: `session_id` (guest identity), `token` (per-room secret proving ownership), idempotency key, name/avatar/color, readiness, bot difficulty, heartbeat |
| `games` | one row per match; `state` jsonb holds the **full authoritative engine state including correct answers** — reachable only by the service role |
| `player_answers` | per-answer audit written by the server (selected index, correctness, response ms, base/speed/streak/total points) |
| `bible_questions` | mirror of both question pools for admin tooling (`npm run db:seed`); gameplay reads the code banks |
| `game_events` | append-only "sync" feed; the ONLY table browsers can read, used to trigger snapshot refetches over Realtime |
| `tournament_answers` | contention-free answer inbox for tournament questions |
| `tournament_question_locks` | marks a tournament question closed; makes "collect answers" and "reveal" one atomic step |
| `rate_limit_counters` | shared fixed-window rate limit, so limits survive serverless cold starts |
| `profiles`, `player_statistics` | prepared for optional registered-player stats (not yet surfaced in UI) |

## Security model (RLS)

- **Every table has RLS enabled.** Anon/authenticated roles get **no policies or table privileges** on authoritative game tables, so they can read and write nothing. All game traffic goes through Next.js API routes using the server-only Supabase secret key.
- `service_role` holds **explicit** table, sequence and function grants. Bypassing RLS is not the same as holding privileges: current Supabase projects no longer expose new tables to the Data API by default, so without those grants every server query fails with "permission denied".
- `game_events` has an anon SELECT policy so browsers can subscribe to Realtime inserts, narrowed to the last 10 minutes. Events name nobody and carry no secrets — just "room X changed, refetch your snapshot" — and retention deletes them, so the feed cannot be mined as an activity log. Residual: an anon key can still observe that *some* room changed. Closing that fully needs authenticated Realtime channels, which this project does not have yet.
- `profiles` / `player_statistics` allow authenticated users to access **their own row only** (`auth.uid()` checks), ready for future accounts.
- The secret key lives exclusively in the server environment (`SUPABASE_SECRET_KEY`, guarded by the `server-only` package so importing it into client code fails the build).

Why this design: the requirement "clients must not be able to read correct answers or modify scores" is enforced at the database boundary, not just in application code. Even a hand-crafted Supabase client with the publishable key sees zero authoritative rows.

The matching rule in application code is that online matches only ever draw from `ONLINE_QUESTION_BANK`, which is `server-only`. Solo and Local play must grade answers on-device, so their pool ships to the browser answer key and all; a database that hides the answer buys nothing if the same question can be looked up in a JavaScript chunk. The two pools are disjoint.

## Data flow of one online answer

1. Browser POSTs `/api/rooms/K7M3P/answer` with `{playerId, token, answerIndex}`.
2. Route validates with Zod, rate-limits, loads the room (+state), **settles** due transitions, and runs the engine's `SUBMIT_ANSWER` (which rejects late/duplicate/invalid answers).
3. Call `commit_room_state`, which atomically checks/bump the room version, saves the game document, writes the answer audit, and inserts the sync event. On conflict, the request reloads and retries.
4. All clients receive the `game_events` insert and refetch their sanitized snapshot.
5. At reveal, scores are computed server-side and audit rows land in `player_answers`.

## Tournament answers

At 30 players the room's optimistic-version lock cannot absorb 30 submissions in
the same two seconds, so tournament answers bypass it: each lands in
`tournament_answers` under its own primary key, and the server folds the batch
into engine state at reveal.

Reveal is the delicate part. Collecting the answers and committing the reveal
must not be two separate steps, or an answer arriving in between is accepted by
the API and then never scored. `close_tournament_question` does both under one
exclusive lock on the game row: it waits for in-flight submissions to commit,
records the question as closed, and returns the final set. `submit_tournament_answer`
takes a *share* lock — no contention between players, full mutual exclusion
against the close — and refuses a question already marked closed.

## Maintenance

- `cleanup_expired_rooms()` deletes expired and abandoned rooms (cascading to
  players, games, answers and events), trims the sync feed to the last 30
  minutes, and drops stale rate-limit rows.
- Migration 5 schedules it every 15 minutes with `pg_cron` where the extension
  is available. If it is not, the API also runs it opportunistically on roughly
  one room creation in ten, so retention never depends on cron existing.
