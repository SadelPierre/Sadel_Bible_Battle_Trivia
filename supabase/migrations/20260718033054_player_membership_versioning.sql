-- Do not admit a new seat after a game has started. Locking the room row here
-- serializes this check with the authoritative room-state commit.
create or replace function private.enforce_room_capacity()
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

-- Invalidate stale lobby/game snapshots when the roster or ready state changes.
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
