create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  favorite_game text not null default '',
  bio text not null default '',
  avatar text not null default '',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Columnas que pueden faltar si la tabla ya existia (idempotente).
alter table public.profiles
  add column if not exists created_at timestamp with time zone not null default now(),
  add column if not exists updated_at timestamp with time zone not null default now();

-- Integridad: longitudes razonables, no permitir name vacio.
alter table public.profiles
  drop constraint if exists profiles_name_len_chk;
alter table public.profiles
  add  constraint profiles_name_len_chk
  check (char_length(trim(name)) between 1 and 60);

alter table public.profiles
  drop constraint if exists profiles_bio_len_chk;
alter table public.profiles
  add  constraint profiles_bio_len_chk
  check (char_length(bio) <= 500);

alter table public.profiles
  drop constraint if exists profiles_favgame_len_chk;
alter table public.profiles
  add  constraint profiles_favgame_len_chk
  check (char_length(favorite_game) <= 120);

-- Indice trigram para busqueda fuzzy por nombre (RPC search_profiles).
create index if not exists profiles_name_trgm_idx
  on public.profiles using gin (name gin_trgm_ops);

-- Trigger updated_at.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.tg_set_updated_at();

alter table public.profiles enable row level security;

-- Cualquier usuario autenticado puede leer perfiles publicos (necesario para feed,
-- chat, follows, busqueda de usuarios, etc).
drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, favorite_game, bio, avatar)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), 'Jugador'),
    coalesce(new.raw_user_meta_data ->> 'favoriteGame', ''),
    coalesce(new.raw_user_meta_data ->> 'bio', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    name = excluded.name,
    favorite_game = excluded.favorite_game,
    bio = excluded.bio,
    avatar = excluded.avatar;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
--  RPC: search_profiles
--  Busqueda fuzzy de usuarios para autocompletar (follows,
--  crear grupos, etc). Excluye al propio usuario.
-- =========================================================
create or replace function public.search_profiles(q text, max_results int default 10)
returns table (
  id uuid,
  name text,
  avatar text,
  bio text
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.name, p.avatar, p.bio
    from public.profiles p
   where p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     and (
       q is null
       or length(trim(q)) = 0
       or p.name ilike '%' || q || '%'
       or p.name % q
     )
   order by similarity(p.name, coalesce(q, '')) desc, p.name asc
   limit greatest(1, least(coalesce(max_results, 10), 50));
$$;

grant execute on function public.search_profiles(text, int) to authenticated;
