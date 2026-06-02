create extension if not exists pgcrypto;

create table if not exists public.rawg_games (
  rawg_id bigint primary key,
  name text not null,
  background_image text,
  rating numeric(3, 1) not null default 0 check (rating >= 0 and rating <= 5),
  released date,
  updated_at timestamp with time zone not null default now()
);

create index if not exists rawg_games_name_trgm_idx
  on public.rawg_games using gin (name gin_trgm_ops);

drop trigger if exists rawg_games_set_updated_at on public.rawg_games;
create trigger rawg_games_set_updated_at
before update on public.rawg_games
for each row execute function public.tg_set_updated_at();

create table if not exists public.favorite_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rawg_id bigint not null,
  name text not null,
  background_image text,
  rating numeric(3, 1) not null default 0,
  released date,
  created_at timestamp with time zone not null default now(),
  unique (user_id, rawg_id)
);

create index if not exists favorite_games_user_id_created_at_idx
  on public.favorite_games (user_id, created_at desc);

alter table public.rawg_games enable row level security;
alter table public.favorite_games enable row level security;

drop policy if exists "Authenticated users can read rawg cache" on public.rawg_games;
create policy "Authenticated users can read rawg cache"
on public.rawg_games
for select
to authenticated
using (true);

-- La cache es compartida: permitimos INSERT/UPDATE (upsert) pero NO DELETE.
drop policy if exists "Authenticated users can upsert rawg cache" on public.rawg_games;
drop policy if exists "Authenticated users can insert rawg cache" on public.rawg_games;
create policy "Authenticated users can insert rawg cache"
on public.rawg_games
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update rawg cache" on public.rawg_games;
create policy "Authenticated users can update rawg cache"
on public.rawg_games
for update
to authenticated
using (true)
with check (true);
-- DELETE intencionalmente NO permitido a usuarios. Reservado a service_role.

drop policy if exists "Users can read own favorite games" on public.favorite_games;
create policy "Users can read own favorite games"
on public.favorite_games
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own favorite games" on public.favorite_games;
create policy "Users can insert own favorite games"
on public.favorite_games
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own favorite games" on public.favorite_games;
create policy "Users can delete own favorite games"
on public.favorite_games
for delete
to authenticated
using ((select auth.uid()) = user_id);
