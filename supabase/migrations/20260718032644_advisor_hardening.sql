-- Make the intentional deny-by-default posture explicit to Supabase's linter.
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

-- Supports future registered-account lookups and foreign-key maintenance.
create index idx_room_players_user on public.room_players (user_id)
  where user_id is not null;
