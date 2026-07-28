-- Bible Battle Live — hardening pass
--
-- Five independent problems, all of them things that only bite in production:
--   1. service_role had no explicit table privileges (new Supabase projects no
--      longer hand them out, so every .from(...) call could fail).
--   2. A tournament question could be revealed while an accepted answer was
--      still in flight, silently scoring that player zero.
--   3. Room creation was three separate writes with no rollback and no
--      idempotency, so a failure or a retry left orphan rows or duplicate rooms.
--   4. Rate limiting lived in per-instance memory, which a serverless platform
--      resets at will.
--   5. Nothing ever deleted expired rooms or the sync-event history.

-- ── 1. explicit Data API privileges for the server client ───────────────────
-- supabaseAdmin() reaches these tables through PostgREST as service_role.
-- Bypassing RLS is not the same as holding table privileges: without the grants
-- below, a project created under the current default denies every read and
-- write with "permission denied", RLS bypass notwithstanding.
grant usage on schema public to service_role;

grant select, insert, update, delete on table
  public.game_rooms,
  public.room_players,
  public.games,
  public.player_answers,
  public.bible_questions,
  public.game_events,
  public.tournament_answers,
  public.profiles,
  public.player_statistics
to service_role;

grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- ── 2. closing a tournament question atomically ─────────────────────────────
-- The old flow read the answer inbox, then committed the reveal in a separate
-- statement. An answer that arrived between those two points was accepted by
-- the API and then never folded into scoring — the player saw "answered" and
-- scored zero, or was eliminated. Closing the question is now a single locked
-- step: after it returns, no further answer for that question is accepted.
create table if not exists public.tournament_question_locks (
  game_id uuid not null references public.games (id) on delete cascade,
  question_index int not null check (question_index >= 0),
  closed_at timestamptz not null default now(),
  primary key (game_id, question_index)
);

alter table public.tournament_question_locks enable row level security;
revoke all on table public.tournament_question_locks from anon, authenticated;
grant select, insert, update, delete on table public.tournament_question_locks to service_role;

drop policy if exists "deny browser tournament lock access" on public.tournament_question_locks;
create policy "deny browser tournament lock access" on public.tournament_question_locks
  for all to anon, authenticated using (false) with check (false);

-- Submission now takes a SHARE lock on the game row and refuses a question that
-- has already been closed. Share locks do not conflict with each other, so 30
-- players still submit concurrently; they conflict only with the EXCLUSIVE lock
-- that close_tournament_question takes, which is exactly the race we need gone.
create or replace function public.submit_tournament_answer(
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
  perform 1 from public.games where id = p_game_id for share;

  -- Either this commits before the close acquires its exclusive lock (and the
  -- close therefore sees the answer), or the close has already committed and
  -- the lock row below exists. There is no third ordering.
  if exists (
    select 1
    from public.tournament_question_locks
    where game_id = p_game_id and question_index = p_question_index
  ) then
    return false;
  end if;

  insert into public.tournament_answers (
    game_id, question_index, player_id, answer_index, response_ms
  ) values (
    p_game_id, p_question_index, p_player_id, p_answer_index, p_response_ms
  )
  on conflict (game_id, question_index, player_id) do nothing;

  get diagnostics v_inserted = row_count;

  -- Nudge other clients to refetch. The payload carries nothing: this feed is
  -- readable with the browser key, so it must not name who answered.
  if v_inserted then
    insert into public.game_events (room_id, type, payload)
      values (p_room_id, 'sync', '{}'::jsonb);
  end if;

  return v_inserted;
end;
$$;

revoke all on function public.submit_tournament_answer(uuid, uuid, int, uuid, int, int)
  from public, anon, authenticated;
grant execute on function public.submit_tournament_answer(uuid, uuid, int, uuid, int, int)
  to service_role;

-- Close the question and hand back its final, complete answer set.
-- Idempotent: closing twice returns the same rows, so a settle pass that loses
-- the optimistic-version race can simply re-run.
create or replace function public.close_tournament_question(
  p_game_id uuid,
  p_question_index int
)
returns setof public.tournament_answers
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Waits for every in-flight submission to commit, then blocks later ones.
  perform 1 from public.games where id = p_game_id for update;

  insert into public.tournament_question_locks (game_id, question_index)
  values (p_game_id, p_question_index)
  on conflict (game_id, question_index) do nothing;

  return query
    select *
    from public.tournament_answers
    where game_id = p_game_id and question_index = p_question_index
    order by submitted_at asc;
end;
$$;

revoke all on function public.close_tournament_question(uuid, int)
  from public, anon, authenticated;
grant execute on function public.close_tournament_question(uuid, int)
  to service_role;

-- ── 3. transactional, idempotent room creation ──────────────────────────────
-- Room, host seat, and host pointer are one transaction. p_operation_id makes a
-- retry return the original room instead of creating a second one, which is
-- what used to happen whenever a response was lost in flight.
create or replace function public.create_room_with_host(
  p_room_code text,
  p_game_mode text,
  p_max_players int,
  p_settings jsonb,
  p_operation_id uuid,
  p_session_id text,
  p_display_name text,
  p_avatar text,
  p_player_color text
)
returns table (room_code text, player_id uuid, player_token uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_player_id uuid;
  v_token uuid;
  v_code text;
begin
  select gr.room_code, rp.id, rp.token
    into v_code, v_player_id, v_token
    from public.room_players rp
    join public.game_rooms gr on gr.id = rp.room_id
    where rp.operation_id = p_operation_id;

  if found then
    room_code := v_code;
    player_id := v_player_id;
    player_token := v_token;
    return next;
    return;
  end if;

  insert into public.game_rooms (room_code, status, game_mode, max_players, settings)
  values (p_room_code, 'lobby', p_game_mode, p_max_players, coalesce(p_settings, '{}'::jsonb))
  returning id into v_room_id;

  insert into public.room_players (
    room_id, operation_id, session_id, display_name, avatar, player_color,
    is_host, is_ready
  ) values (
    v_room_id, p_operation_id, p_session_id, p_display_name, p_avatar, p_player_color,
    true, true
  )
  returning id, token into v_player_id, v_token;

  update public.game_rooms
    set host_player_id = v_player_id
    where id = v_room_id;

  room_code := p_room_code;
  player_id := v_player_id;
  player_token := v_token;
  return next;
end;
$$;

revoke all on function public.create_room_with_host(
  text, text, int, jsonb, uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_room_with_host(
  text, text, int, jsonb, uuid, text, text, text, text
) to service_role;

-- ── 4. durable rate limiting ────────────────────────────────────────────────
-- Fixed window per key. Shared by every serverless instance, and unaffected by
-- cold starts — unlike the in-memory limiter, which a scaled-out deployment
-- effectively multiplies by its instance count.
create table if not exists public.rate_limit_counters (
  bucket_key text primary key,
  window_started_at timestamptz not null default now(),
  hits int not null default 0
);

alter table public.rate_limit_counters enable row level security;
revoke all on table public.rate_limit_counters from anon, authenticated;
grant select, insert, update, delete on table public.rate_limit_counters to service_role;

drop policy if exists "deny browser rate limit access" on public.rate_limit_counters;
create policy "deny browser rate limit access" on public.rate_limit_counters
  for all to anon, authenticated using (false) with check (false);

create or replace function public.rate_limit_hit(
  p_key text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hits int;
  v_cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  insert into public.rate_limit_counters (bucket_key, window_started_at, hits)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update
    set hits = case
          when public.rate_limit_counters.window_started_at < v_cutoff then 1
          else public.rate_limit_counters.hits + 1
        end,
        window_started_at = case
          when public.rate_limit_counters.window_started_at < v_cutoff then now()
          else public.rate_limit_counters.window_started_at
        end
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.rate_limit_hit(text, int, int)
  from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- ── 5. retention ────────────────────────────────────────────────────────────
-- Rooms carry a 24h expiry that nothing acted on, so expired rooms, their
-- players, games, answers and events accumulated forever.
create or replace function public.cleanup_expired_rooms(
  p_event_retention_minutes int default 30
)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted int;
begin
  -- Cascades to room_players, games, player_answers, tournament_answers,
  -- tournament_question_locks and game_events.
  delete from public.game_rooms
    where expires_at < now()
       or (status = 'abandoned' and created_at < now() - interval '1 hour');
  get diagnostics v_deleted = row_count;

  -- The sync feed is a nudge, not a log. Nobody reads an old event.
  delete from public.game_events
    where created_at < now() - make_interval(mins => p_event_retention_minutes);

  delete from public.rate_limit_counters
    where window_started_at < now() - interval '1 day';

  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_rooms(int)
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_rooms(int) to service_role;

-- Schedule it if the project has pg_cron. If it does not, the API still calls
-- cleanup opportunistically on room creation, so retention never depends on
-- this block succeeding.
do $$
begin
  create extension if not exists pg_cron;
  if not exists (select 1 from cron.job where jobname = 'cleanup-expired-rooms') then
    perform cron.schedule(
      'cleanup-expired-rooms',
      '*/15 * * * *',
      $cron$select public.cleanup_expired_rooms();$cron$
    );
  end if;
exception
  when others then
    raise notice 'pg_cron unavailable; public.cleanup_expired_rooms() must be scheduled externally';
end
$$;

-- ── sync feed: stop serving history to the browser ──────────────────────────
-- The browser key can read this feed (Realtime needs it), so it must expose as
-- little as possible. Payloads no longer name players, and only live events are
-- visible — an old feed is an activity log of every room that ever existed.
drop policy if exists "read sync events" on public.game_events;
drop policy if exists "read recent sync events" on public.game_events;
create policy "read recent sync events"
  on public.game_events for select
  to anon, authenticated
  using (created_at > now() - interval '10 minutes');
