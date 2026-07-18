-- Bible Battle Live — production schema
--
-- The browser never writes game state directly. Next.js API routes use the
-- server-only secret key, while Row Level Security denies browser access
-- to authoritative rooms, answers, scores, and question data.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ── profiles (optional accounts; guests never create rows here) ─────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 20),
  created_at timestamptz not null default now()
);

-- ── game rooms ──────────────────────────────────────────────────────────────
create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null
    check (room_code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  host_player_id uuid,
  status text not null default 'lobby'
    check (status in ('lobby', 'playing', 'complete', 'abandoned')),
  game_mode text not null default 'online'
    check (game_mode = 'online'),
  max_players int not null default 4 check (max_players between 2 and 4),
  settings jsonb not null default '{}',
  current_game_id uuid,
  -- Optimistic-concurrency guard. public.commit_room_state bumps this inside
  -- the same transaction that writes the authoritative game document.
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index idx_game_rooms_expires on public.game_rooms (expires_at);

-- ── players in a room ───────────────────────────────────────────────────────
create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  user_id uuid references auth.users (id),
  session_id text,
  -- Per-room secret returned once to the owning browser. It proves ownership
  -- on API calls and is never exposed in room snapshots.
  token uuid not null default gen_random_uuid(),
  -- Idempotency key for retrying a bot insertion after an optimistic conflict.
  operation_id uuid,
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar text not null default 'dove',
  player_color text not null default 'royal',
  is_host boolean not null default false,
  is_ready boolean not null default false,
  is_computer boolean not null default false,
  computer_difficulty text check (computer_difficulty in ('easy', 'medium', 'hard')),
  connection_status text not null default 'connected'
    check (connection_status in ('connected', 'disconnected')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  check (
    (is_computer and session_id is null and computer_difficulty is not null)
    or
    (not is_computer and session_id is not null and computer_difficulty is null)
  )
);
create index idx_room_players_room on public.room_players (room_id);
create index idx_room_players_user on public.room_players (user_id)
  where user_id is not null;
create unique index uq_room_players_session
  on public.room_players (room_id, session_id)
  where session_id is not null;
create unique index uq_room_players_operation
  on public.room_players (operation_id)
  where operation_id is not null;

-- Serialize seat inserts on the room row so simultaneous joins cannot exceed
-- max_players. The API translates the room_full exception into a friendly 409.
create function private.enforce_room_capacity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_max_players integer;
  v_player_count integer;
  v_room_status text;
begin
  select max_players, status
    into v_max_players, v_room_status
    from public.game_rooms
    where id = new.room_id
    for update;

  if v_max_players is null then
    raise exception using errcode = '23503', message = 'room_not_found';
  end if;

  if v_room_status <> 'lobby' then
    raise exception using errcode = 'P0001', message = 'room_not_joinable';
  end if;

  select count(*)
    into v_player_count
    from public.room_players
    where room_id = new.room_id;

  if v_player_count >= v_max_players then
    raise exception using errcode = 'P0001', message = 'room_full';
  end if;

  return new;
end;
$$;

create trigger enforce_room_capacity_before_insert
  before insert on public.room_players
  for each row execute function private.enforce_room_capacity();

-- Membership/readiness changes bump the same optimistic version used by game
-- commits. This makes a simultaneous join/leave/ready action invalidate a host
-- start request that loaded the old lobby roster.
create function private.bump_room_version_for_player_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_next_version bigint;
begin
  if tg_op = 'DELETE' then
    v_room_id := old.room_id;
  else
    v_room_id := new.room_id;
  end if;

  update public.game_rooms
    set version = version + 1
    where id = v_room_id
    returning version into v_next_version;

  if v_next_version is not null then
    insert into public.game_events (room_id, type, payload)
      values (v_room_id, 'sync', jsonb_build_object('v', v_next_version));
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger bump_room_version_after_membership_change
  after insert or delete on public.room_players
  for each row execute function private.bump_room_version_for_player_change();

create trigger bump_room_version_after_ready_change
  after update of is_ready on public.room_players
  for each row
  when (old.is_ready is distinct from new.is_ready)
  execute function private.bump_room_version_for_player_change();

-- ── games (full engine state is server-only) ────────────────────────────────
create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'complete', 'abandoned')),
  state jsonb not null,
  question_ids text[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index idx_games_room on public.games (room_id);

-- ── per-answer audit trail ──────────────────────────────────────────────────
create table public.player_answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  question_index int not null check (question_index >= 0),
  question_id text not null,
  player_id uuid not null,
  selected_answer_index int check (selected_answer_index between 0 and 3),
  is_correct boolean not null default false,
  response_time_ms int check (response_time_ms >= 0),
  base_points int not null default 0 check (base_points >= 0),
  speed_bonus int not null default 0 check (speed_bonus >= 0),
  streak_bonus int not null default 0 check (streak_bonus >= 0),
  total_points int not null default 0 check (total_points >= 0),
  submitted_at timestamptz not null default now(),
  unique (game_id, question_index, player_id)
);
create index idx_player_answers_game on public.player_answers (game_id);

-- ── question bank mirror (gameplay itself uses the reviewed code bank) ──────
create table public.bible_questions (
  id text primary key,
  question text not null,
  options jsonb not null,
  correct_answer_index int not null check (correct_answer_index between 0 and 3),
  bible_reference text not null,
  scripture_excerpt text,
  explanation text not null,
  category text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  testament text not null check (testament in ('old', 'new', 'both')),
  tags text[] not null default '{}',
  source_translation text,
  is_reviewed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
);

-- ── aggregate statistics for future registered-player accounts ─────────────
create table public.player_statistics (
  user_id uuid primary key references auth.users (id) on delete cascade,
  games_played int not null default 0 check (games_played >= 0),
  games_won int not null default 0 check (games_won >= 0),
  total_correct int not null default 0 check (total_correct >= 0),
  total_questions int not null default 0 check (total_questions >= 0),
  total_response_ms bigint not null default 0 check (total_response_ms >= 0),
  best_streak int not null default 0 check (best_streak >= 0),
  category_stats jsonb not null default '{}',
  difficulty_stats jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ── Realtime notification feed ──────────────────────────────────────────────
-- Events contain only a room UUID and version. Browsers use inserts as a nudge
-- to refetch the sanitized Next.js snapshot; no answers or tokens are stored.
create table public.game_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  type text not null default 'sync' check (type = 'sync'),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_game_events_room on public.game_events (room_id, id desc);

-- ── Atomic authoritative-state commit ───────────────────────────────────────
-- This function is SECURITY INVOKER and executable only by service_role. It
-- prevents a room version update and a game-state update from being observed or
-- overwritten separately under concurrent server requests.
create function public.commit_room_state(
  p_room_id uuid,
  p_expected_version bigint,
  p_host_player_id uuid,
  p_status text,
  p_settings jsonb,
  p_current_game_id uuid,
  p_game_state jsonb,
  p_question_ids text[],
  p_answer_rows jsonb,
  p_completed_at timestamptz
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_next_version bigint;
  v_game_status text;
begin
  if p_status not in ('lobby', 'playing', 'complete', 'abandoned') then
    raise exception using errcode = '22023', message = 'invalid_room_status';
  end if;

  update public.game_rooms
    set host_player_id = p_host_player_id,
        status = p_status,
        settings = coalesce(p_settings, '{}'::jsonb),
        current_game_id = p_current_game_id,
        version = version + 1
    where id = p_room_id
      and version = p_expected_version
    returning version into v_next_version;

  if v_next_version is null then
    return null;
  end if;

  update public.room_players
    set is_host = (id = p_host_player_id)
    where room_id = p_room_id
      and is_host is distinct from (id = p_host_player_id);

  if p_current_game_id is not null and p_game_state is not null then
    if exists (
      select 1 from public.games
      where id = p_current_game_id and room_id <> p_room_id
    ) then
      raise exception using errcode = '23514', message = 'game_room_mismatch';
    end if;

    v_game_status := case
      when p_status = 'complete' then 'complete'
      when p_status = 'abandoned' then 'abandoned'
      else 'active'
    end;

    insert into public.games (
      id, room_id, status, state, question_ids, completed_at
    ) values (
      p_current_game_id,
      p_room_id,
      v_game_status,
      p_game_state,
      coalesce(p_question_ids, '{}'::text[]),
      p_completed_at
    )
    on conflict (id) do update
      set status = excluded.status,
          state = excluded.state,
          question_ids = excluded.question_ids,
          completed_at = excluded.completed_at;
  end if;

  if p_answer_rows is not null then
    if jsonb_typeof(p_answer_rows) <> 'array' then
      raise exception using errcode = '22023', message = 'answer_rows_must_be_an_array';
    end if;

    insert into public.player_answers (
      game_id,
      question_index,
      question_id,
      player_id,
      selected_answer_index,
      is_correct,
      response_time_ms,
      base_points,
      speed_bonus,
      streak_bonus,
      total_points,
      submitted_at
    )
    select
      p_current_game_id,
      row.question_index,
      row.question_id,
      row.player_id,
      row.selected_answer_index,
      row.is_correct,
      row.response_time_ms,
      row.base_points,
      row.speed_bonus,
      row.streak_bonus,
      row.total_points,
      coalesce(row.submitted_at, now())
    from jsonb_to_recordset(p_answer_rows) as row (
      question_index int,
      question_id text,
      player_id uuid,
      selected_answer_index int,
      is_correct boolean,
      response_time_ms int,
      base_points int,
      speed_bonus int,
      streak_bonus int,
      total_points int,
      submitted_at timestamptz
    )
    where p_current_game_id is not null
    on conflict (game_id, question_index, player_id) do update
      set selected_answer_index = excluded.selected_answer_index,
          is_correct = excluded.is_correct,
          response_time_ms = excluded.response_time_ms,
          base_points = excluded.base_points,
          speed_bonus = excluded.speed_bonus,
          streak_bonus = excluded.streak_bonus,
          total_points = excluded.total_points,
          submitted_at = excluded.submitted_at;
  end if;

  insert into public.game_events (room_id, type, payload)
    values (p_room_id, 'sync', jsonb_build_object('v', v_next_version));

  return v_next_version;
end;
$$;

revoke all on function public.commit_room_state(
  uuid, bigint, uuid, text, jsonb, uuid, jsonb, text[], jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.commit_room_state(
  uuid, bigint, uuid, text, jsonb, uuid, jsonb, text[], jsonb, timestamptz
) to service_role;

-- ── Row Level Security and explicit Data API privileges ─────────────────────
alter table public.profiles enable row level security;
alter table public.game_rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.games enable row level security;
alter table public.player_answers enable row level security;
alter table public.bible_questions enable row level security;
alter table public.player_statistics enable row level security;
alter table public.game_events enable row level security;

revoke all on table
  public.game_rooms,
  public.room_players,
  public.games,
  public.player_answers,
  public.bible_questions
from anon, authenticated;

revoke all on table public.profiles, public.player_statistics, public.game_events
from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select on table public.player_statistics to authenticated;
grant select on table public.game_events to anon, authenticated;

-- Explicit deny policies make the intentional deny-by-default posture visible
-- to database tooling. Privileges are also revoked above (defense in depth).
create policy "deny browser room access" on public.game_rooms for all
  to anon, authenticated using (false) with check (false);
create policy "deny browser player access" on public.room_players for all
  to anon, authenticated using (false) with check (false);
create policy "deny browser game access" on public.games for all
  to anon, authenticated using (false) with check (false);
create policy "deny browser answer access" on public.player_answers for all
  to anon, authenticated using (false) with check (false);
create policy "deny browser question access" on public.bible_questions for all
  to anon, authenticated using (false) with check (false);

create policy "read sync events"
  on public.game_events for select
  to anon, authenticated
  using (true);

create policy "read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "read own statistics"
  on public.player_statistics for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Publish inserts on the small sync feed. RLS + table privileges still apply.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_events'
  ) then
    alter publication supabase_realtime add table public.game_events;
  end if;
end
$$;
