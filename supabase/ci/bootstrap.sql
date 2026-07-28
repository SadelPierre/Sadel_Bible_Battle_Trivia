-- Minimal stand-in for the pieces Supabase provides out of the box, so the
-- migration chain can be replayed against a plain Postgres container in CI.
--
-- This exists to catch one specific class of bug: a migration that only applies
-- cleanly to the maintainer's database and aborts on a blank one. It is not a
-- Supabase emulator and must never be run against a real project.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;

-- Enough of auth.users for the foreign keys in 0001_init.sql to resolve.
create table if not exists auth.users (
  id uuid primary key
);

-- The policies in 0001_init.sql call auth.uid(). Always-null is fine here: this
-- job checks that the migrations apply, not that the policies grant the right
-- rows to the right user.
create function auth.uid()
returns uuid
language sql
stable
as $$ select null::uuid $$;

-- Realtime publication that 0001_init.sql adds game_events to.
create publication supabase_realtime;
