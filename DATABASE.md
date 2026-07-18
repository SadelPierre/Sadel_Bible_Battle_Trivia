# Database

One migration creates everything: `supabase/migrations/0001_init.sql`. Run it in the Supabase SQL Editor (or `npx supabase db push`).

## Tables

| Table | Purpose |
| --- | --- |
| `game_rooms` | one row per room: `room_code` (unique 5-letter), `host_player_id`, `status` (lobby/playing/complete/abandoned), `max_players`, `settings` jsonb, `current_game_id`, `version` (optimistic lock), `expires_at` (24 h) |
| `room_players` | seats: `session_id` (guest identity), `token` (per-room secret proving ownership), idempotency key, name/avatar/color, readiness, bot difficulty, heartbeat |
| `games` | one row per match; `state` jsonb holds the **full authoritative engine state including correct answers** — reachable only by the service role |
| `player_answers` | per-answer audit written by the server (selected index, correctness, response ms, base/speed/streak/total points) |
| `bible_questions` | mirror of the code question bank for admin tooling (`npm run db:seed`); gameplay reads the bundled bank |
| `game_events` | append-only "sync" feed; the ONLY table browsers can read, used to trigger snapshot refetches over Realtime |
| `profiles`, `player_statistics` | prepared for optional registered-player stats (not yet surfaced in UI) |

## Security model (RLS)

- **Every table has RLS enabled.** Anon/authenticated roles get **no policies or table privileges** on authoritative game tables, so they can read and write nothing. All game traffic goes through Next.js API routes using the server-only Supabase secret key.
- `game_events` has a single anon SELECT policy so browsers can subscribe to Realtime inserts. Events contain no secrets — just "room X changed, refetch your snapshot".
- `profiles` / `player_statistics` allow authenticated users to access **their own row only** (`auth.uid()` checks), ready for future accounts.
- The secret key lives exclusively in the server environment (`SUPABASE_SECRET_KEY`, guarded by the `server-only` package so importing it into client code fails the build).

Why this design: the requirement "clients must not be able to read correct answers or modify scores" is enforced at the database boundary, not just in application code. Even a hand-crafted Supabase client with the publishable key sees zero authoritative rows.

## Data flow of one online answer

1. Browser POSTs `/api/rooms/K7M3P/answer` with `{playerId, token, answerIndex}`.
2. Route validates with Zod, rate-limits, loads the room (+state), **settles** due transitions, and runs the engine's `SUBMIT_ANSWER` (which rejects late/duplicate/invalid answers).
3. Call `commit_room_state`, which atomically checks/bump the room version, saves the game document, writes the answer audit, and inserts the sync event. On conflict, the request reloads and retries.
4. All clients receive the `game_events` insert and refetch their sanitized snapshot.
5. At reveal, scores are computed server-side and audit rows land in `player_answers`.

## Maintenance

- Expired/abandoned rooms are denied at the API (`expires_at`, status checks). To clean up old rows periodically, schedule in Supabase (Database → Cron):
  ```sql
  delete from game_rooms where expires_at < now() - interval '1 day';
  ```
  Cascades remove players, games, answers, and events.
