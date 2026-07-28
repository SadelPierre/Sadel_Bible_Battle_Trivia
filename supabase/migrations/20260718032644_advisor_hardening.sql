-- Make the intentional deny-by-default posture explicit to Supabase's linter.
--
-- 0001_init.sql was later updated to create these objects itself, so on a blank
-- database this migration is a replay of work that already happened. Every
-- statement is therefore written to be safely re-runnable — a migration that
-- only succeeds against one particular historical database is not a migration.
drop policy if exists "deny browser room access" on public.game_rooms;
create policy "deny browser room access" on public.game_rooms for all
  to anon, authenticated using (false) with check (false);

drop policy if exists "deny browser player access" on public.room_players;
create policy "deny browser player access" on public.room_players for all
  to anon, authenticated using (false) with check (false);

drop policy if exists "deny browser game access" on public.games;
create policy "deny browser game access" on public.games for all
  to anon, authenticated using (false) with check (false);

drop policy if exists "deny browser answer access" on public.player_answers;
create policy "deny browser answer access" on public.player_answers for all
  to anon, authenticated using (false) with check (false);

drop policy if exists "deny browser question access" on public.bible_questions;
create policy "deny browser question access" on public.bible_questions for all
  to anon, authenticated using (false) with check (false);

-- Supports future registered-account lookups and foreign-key maintenance.
create index if not exists idx_room_players_user on public.room_players (user_id)
  where user_id is not null;
