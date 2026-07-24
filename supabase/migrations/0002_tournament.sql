-- Bible Battle Live — tournament mode (survival elimination + duel final)
--
-- Adds a large-field "knockout" mode where up to 30 players answer the same
-- question stream and the lowest performers are cut after each round until a
-- head-to-head duel crowns one champion.
--
-- The single hard problem at 30 players is write contention: the standard
-- online path funnels every answer through the room's optimistic-version lock
-- (game_rooms.version), which is fine for 4 players but melts down when 30
-- people tap an answer inside the same 2-second window. This migration adds a
-- contention-free "answer inbox": tournament answers are inserted straight into
-- their own table keyed by (game, question, player) — distinct primary keys, no
-- shared row — and the authoritative server folds them into engine state in a
-- single batched commit at reveal time. Reads of the room row are never blocked.

-- ── relax room limits for tournament fields ─────────────────────────────────
alter table public.game_rooms
  drop constraint game_rooms_max_players_check;
alter table public.game_rooms
  add constraint game_rooms_max_players_check
  check (max_players between 2 and 30);

alter table public.game_rooms
  drop constraint game_rooms_game_mode_check;
alter table public.game_rooms
  add constraint game_rooms_game_mode_check
  check (game_mode in ('online', 'tournament'));

-- ── the answer inbox ────────────────────────────────────────────────────────
-- One row per (game, question, player). The primary key makes a second answer
-- from the same player a no-op (first answer wins), so retries and double taps
-- are harmless without any locking. response_ms and submitted_at are computed
-- authoritatively by the server against the question's start/deadline before the
-- row is written, so the engine can fold answers using identical scoring to the
-- live online path.
create table public.tournament_answers (
  game_id uuid not null references public.games (id) on delete cascade,
  question_index int not null check (question_index >= 0),
  player_id uuid not null,
  answer_index int not null check (answer_index between 0 and 3),
  response_ms int not null check (response_ms >= 0),
  submitted_at timestamptz not null default now(),
  primary key (game_id, question_index, player_id)
);
-- Draining the current question reads by (game_id, question_index); the PK's
-- leading columns already serve that lookup.

alter table public.tournament_answers enable row level security;
revoke all on table public.tournament_answers from anon, authenticated;
create policy "deny browser tournament answer access" on public.tournament_answers
  for all to anon, authenticated using (false) with check (false);

-- ── contention-free answer submission ───────────────────────────────────────
-- Called by the service-role API route AFTER it has validated (read-only, no
-- version bump) that the question is live and the answer is on time. Inserts the
-- answer idempotently and emits a Realtime sync nudge so other clients refresh
-- their "who has answered" indicators. Never touches game_rooms.version, so any
-- number of players can submit concurrently without serializing on one row.
create function public.submit_tournament_answer(
  p_room_id uuid,
  p_game_id uuid,
  p_question_index int,
  p_player_id uuid,
  p_answer_index int,
  p_response_ms int
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted boolean := false;
begin
  insert into public.tournament_answers (
    game_id, question_index, player_id, answer_index, response_ms
  ) values (
    p_game_id, p_question_index, p_player_id, p_answer_index, p_response_ms
  )
  on conflict (game_id, question_index, player_id) do nothing;

  get diagnostics v_inserted = row_count;

  -- Only nudge clients when this was a genuinely new answer.
  if v_inserted then
    insert into public.game_events (room_id, type, payload)
      values (p_room_id, 'sync', jsonb_build_object('a', p_player_id));
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.submit_tournament_answer(uuid, uuid, int, uuid, int, int)
  from public, anon, authenticated;
grant execute on function public.submit_tournament_answer(uuid, uuid, int, uuid, int, int)
  to service_role;

-- ── drain the inbox for one question ────────────────────────────────────────
-- Returns every answer for a given game+question so the server can fold them
-- into authoritative engine state in a single batched commit. Idempotent: rows
-- remain in the inbox, so a settle pass that loses the version race simply
-- re-reads and re-folds the same deterministic set on retry.
create function public.drain_tournament_answers(
  p_game_id uuid,
  p_question_index int
)
returns setof public.tournament_answers
language sql
security invoker
set search_path = ''
as $$
  select *
  from public.tournament_answers
  where game_id = p_game_id and question_index = p_question_index
  order by submitted_at asc;
$$;

revoke all on function public.drain_tournament_answers(uuid, int)
  from public, anon, authenticated;
grant execute on function public.drain_tournament_answers(uuid, int)
  to service_role;
