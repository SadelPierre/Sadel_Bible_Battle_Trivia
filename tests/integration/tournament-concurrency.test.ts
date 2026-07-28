// @vitest-environment node

/**
 * Concurrency tests for closing a tournament question.
 *
 * These run against a real Postgres because the property under test is a
 * property of Postgres locking, not of application code: an answer accepted by
 * the API must never be dropped by the reveal that follows it. A mock would
 * assert only that we call the functions we already know we call.
 *
 * Skipped unless DATABASE_URL points at a database with the migrations applied.
 * CI sets it in the `migrations` job; locally:
 *
 *   docker run -d --name bbl-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:15
 *   psql -f supabase/ci/bootstrap.sql && (apply supabase/migrations/*.sql in order)
 *   DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client, Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
const suite = connectionString ? describe : describe.skip;

/** Distinct player ids; tournament_answers.player_id has no FK, so these need no rows. */
const playerId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

suite("closing a tournament question under concurrency", () => {
  let pool: Pool;
  let roomId: string;
  let gameId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 40 });
    const room = await pool.query<{ id: string }>(
      `insert into public.game_rooms (room_code, status, game_mode, max_players, settings)
       values ('TSTAA', 'playing', 'tournament', 30, '{}'::jsonb)
       returning id`,
    );
    roomId = room.rows[0]!.id;
    const game = await pool.query<{ id: string }>(
      `insert into public.games (room_id, state) values ($1, '{}'::jsonb) returning id`,
      [roomId],
    );
    gameId = game.rows[0]!.id;
  });

  afterAll(async () => {
    if (roomId) await pool.query(`delete from public.game_rooms where id = $1`, [roomId]);
    await pool.end();
  });

  const submit = (client: Pool | Client, questionIndex: number, player: number) =>
    client
      .query<{
        submit_tournament_answer: boolean;
      }>(`select public.submit_tournament_answer($1, $2, $3, $4, 1, 500)`, [
        roomId,
        gameId,
        questionIndex,
        playerId(player),
      ])
      .then((r) => r.rows[0]!.submit_tournament_answer);

  const close = (client: Pool | Client, questionIndex: number) =>
    client
      .query<{ player_id: string }>(
        `select player_id from public.close_tournament_question($1, $2)`,
        [gameId, questionIndex],
      )
      .then((r) => r.rows.map((row) => row.player_id));

  it(
    "waits for an in-flight answer instead of revealing without it",
    async () => {
      const QUESTION = 0;

      // An answer that has been accepted but whose transaction has not landed
      // yet. This is the exact window the old read-then-reveal code lost.
      const inFlight = new Client({ connectionString });
      await inFlight.connect();
      await inFlight.query("begin");
      expect(await submit(inFlight, QUESTION, 1)).toBe(true);

      let closeSettled = false;
      const closing = close(pool, QUESTION).then((rows) => {
        closeSettled = true;
        return rows;
      });

      // The close must not be able to finish while the answer is uncommitted.
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(closeSettled, "close revealed without waiting for the in-flight answer").toBe(false);

      await inFlight.query("commit");
      await inFlight.end();

      expect(await closing).toEqual([playerId(1)]);
    },
    20_000,
  );

  it("refuses answers once the question is closed", async () => {
    expect(await submit(pool, 0, 2)).toBe(false);
    expect(await close(pool, 0)).toEqual([playerId(1)]);
  });

  it("leaves the next question open", async () => {
    expect(await submit(pool, 1, 1)).toBe(true);
  });

  it(
    "loses no answer when a full field submits while the question is closing",
    async () => {
      const QUESTION = 2;
      const FIELD = 30;

      // Every player taps at once and the reveal fires into the middle of it.
      // Whatever the interleaving, the invariant holds: an answer the API
      // accepted is an answer the close returns. Anything else is a player who
      // answered and scored zero, or was eliminated for a miss they did not make.
      const submissions = Array.from({ length: FIELD }, (_, i) =>
        submit(pool, QUESTION, i + 1).then((accepted) => ({ player: playerId(i + 1), accepted })),
      );
      const closing = close(pool, QUESTION);

      const [results, closed] = await Promise.all([Promise.all(submissions), closing]);

      const accepted = results.filter((r) => r.accepted).map((r) => r.player);
      const dropped = accepted.filter((p) => !closed.includes(p));

      expect(accepted.length, "no answer was accepted, so the test proved nothing").toBeGreaterThan(
        0,
      );
      expect(dropped, "answers accepted by the API but missing from the reveal").toEqual([]);
      expect(closed.length).toBe(accepted.length);

      // Late arrivals must be refused outright rather than silently dropped.
      const refused = results.filter((r) => !r.accepted).length;
      expect(refused + accepted.length).toBe(FIELD);
    },
    30_000,
  );

  it(
    "keeps first-answer-wins under a double-tap storm",
    async () => {
      const QUESTION = 3;
      const taps = Array.from({ length: 12 }, () => submit(pool, QUESTION, 7));
      const results = await Promise.all(taps);

      expect(results.filter(Boolean).length, "a repeated tap counted more than once").toBe(1);
      expect(await close(pool, QUESTION)).toEqual([playerId(7)]);
    },
    20_000,
  );
});
