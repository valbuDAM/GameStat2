create extension if not exists pgcrypto;

create table if not exists public.game_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rawg_id bigint,
  game text not null,
  title text not null,
  subtitle text not null default '',
  comment text not null,
  rating integer not null check (rating between 1 and 10),
  author text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Columnas que pueden faltar si la tabla ya existia (idempotente).
alter table public.game_reviews
  add column if not exists updated_at timestamp with time zone not null default now();

-- Integridad: no aceptar comentarios vacios ni titulos enormes.
alter table public.game_reviews
  drop constraint if exists game_reviews_title_len_chk;
alter table public.game_reviews
  add  constraint game_reviews_title_len_chk
  check (char_length(trim(title)) between 1 and 120);

alter table public.game_reviews
  drop constraint if exists game_reviews_comment_len_chk;
alter table public.game_reviews
  add  constraint game_reviews_comment_len_chk
  check (char_length(trim(comment)) between 1 and 4000);

-- Cada usuario solo deja UNA review por juego (rawg_id).
-- Si no quieres este limite, comenta esta linea.
create unique index if not exists game_reviews_user_game_unique
  on public.game_reviews (user_id, rawg_id)
  where rawg_id is not null;

create index if not exists game_reviews_rawg_id_idx on public.game_reviews (rawg_id, created_at desc);
create index if not exists game_reviews_user_id_idx on public.game_reviews (user_id, created_at desc);
create index if not exists game_reviews_rating_idx on public.game_reviews (rawg_id, rating);

-- FK a profiles para poder hacer embed PostgREST (profile(name,avatar)).
alter table public.game_reviews
  drop constraint if exists game_reviews_user_profile_fk;
alter table public.game_reviews
  add  constraint game_reviews_user_profile_fk
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- Trigger updated_at.
drop trigger if exists game_reviews_set_updated_at on public.game_reviews;
create trigger game_reviews_set_updated_at
before update on public.game_reviews
for each row execute function public.tg_set_updated_at();

alter table public.game_reviews enable row level security;

drop policy if exists "Authenticated users can read reviews" on public.game_reviews;
create policy "Authenticated users can read reviews"
on public.game_reviews
for select
to authenticated
using (true);

drop policy if exists "Users can insert own reviews" on public.game_reviews;
create policy "Users can insert own reviews"
on public.game_reviews
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own reviews" on public.game_reviews;
create policy "Users can update own reviews"
on public.game_reviews
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own reviews" on public.game_reviews;
create policy "Users can delete own reviews"
on public.game_reviews
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- =========================================================
--  RPC: get_review_stats
--  Devuelve estadisticas agregadas por juego (rawg_id):
--    media, total, y distribucion de 1..10.
--  Pensada para el detalle de juego.
-- =========================================================
create or replace function public.get_review_stats(p_rawg_id bigint)
returns table (
  total_count int,
  avg_rating numeric(4,2),
  rating_1 int, rating_2 int, rating_3 int, rating_4 int, rating_5 int,
  rating_6 int, rating_7 int, rating_8 int, rating_9 int, rating_10 int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::int,
    round(coalesce(avg(rating), 0)::numeric, 2),
    count(*) filter (where rating = 1)::int,
    count(*) filter (where rating = 2)::int,
    count(*) filter (where rating = 3)::int,
    count(*) filter (where rating = 4)::int,
    count(*) filter (where rating = 5)::int,
    count(*) filter (where rating = 6)::int,
    count(*) filter (where rating = 7)::int,
    count(*) filter (where rating = 8)::int,
    count(*) filter (where rating = 9)::int,
    count(*) filter (where rating = 10)::int
  from public.game_reviews
  where rawg_id = p_rawg_id;
$$;

grant execute on function public.get_review_stats(bigint) to authenticated;

-- =========================================================
--  RPC: get_user_review_stats
--  Estadisticas del perfil de un usuario.
-- =========================================================
create or replace function public.get_user_review_stats(p_user uuid)
returns table (
  total_count int,
  avg_rating numeric(4,2),
  last_review_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::int,
    round(coalesce(avg(rating), 0)::numeric, 2),
    max(created_at)
  from public.game_reviews
  where user_id = p_user;
$$;

grant execute on function public.get_user_review_stats(uuid) to authenticated;
