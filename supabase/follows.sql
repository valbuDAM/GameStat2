-- =========================================================
--  follows.sql
--  Sistema de seguir / dejar de seguir entre usuarios.
-- =========================================================

create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_no_self check (follower_id <> followed_id)
);

create index if not exists follows_followed_idx on public.follows (followed_id, created_at desc);
create index if not exists follows_follower_idx on public.follows (follower_id, created_at desc);

alter table public.follows enable row level security;

drop policy if exists "Authenticated users can read follows" on public.follows;
create policy "Authenticated users can read follows"
on public.follows
for select
to authenticated
using (true);

drop policy if exists "Users can follow as themselves" on public.follows;
create policy "Users can follow as themselves"
on public.follows
for insert
to authenticated
with check ((select auth.uid()) = follower_id);

drop policy if exists "Users can unfollow as themselves" on public.follows;
create policy "Users can unfollow as themselves"
on public.follows
for delete
to authenticated
using ((select auth.uid()) = follower_id);

-- =========================================================
--  Helpers / RPCs
-- =========================================================

-- Devuelve true si auth.uid() sigue a target.
create or replace function public.is_following(target uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.follows
     where follower_id = auth.uid() and followed_id = target
  );
$$;

grant execute on function public.is_following(uuid) to authenticated;

-- Contadores de seguidores / siguiendo de un usuario.
create or replace function public.get_follow_counts(target uuid)
returns table (
  followers_count int,
  following_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*)::int from public.follows where followed_id = target),
    (select count(*)::int from public.follows where follower_id = target);
$$;

grant execute on function public.get_follow_counts(uuid) to authenticated;

-- Lista (paginada) de usuarios que siguen a target, con flag is_following
-- para el viewer (auth.uid()).
create or replace function public.list_followers(
  target uuid,
  page_limit int default 20,
  page_offset int default 0
)
returns table (
  id uuid,
  name text,
  avatar text,
  bio text,
  followed_at timestamptz,
  viewer_follows boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.name, p.avatar, p.bio, f.created_at,
         exists(select 1 from public.follows f2
                 where f2.follower_id = auth.uid()
                   and f2.followed_id = p.id) as viewer_follows
    from public.follows f
    join public.profiles p on p.id = f.follower_id
   where f.followed_id = target
   order by f.created_at desc
   limit greatest(1, least(coalesce(page_limit, 20), 100))
  offset greatest(0, coalesce(page_offset, 0));
$$;

grant execute on function public.list_followers(uuid, int, int) to authenticated;

create or replace function public.list_following(
  target uuid,
  page_limit int default 20,
  page_offset int default 0
)
returns table (
  id uuid,
  name text,
  avatar text,
  bio text,
  followed_at timestamptz,
  viewer_follows boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.name, p.avatar, p.bio, f.created_at,
         exists(select 1 from public.follows f2
                 where f2.follower_id = auth.uid()
                   and f2.followed_id = p.id) as viewer_follows
    from public.follows f
    join public.profiles p on p.id = f.followed_id
   where f.follower_id = target
   order by f.created_at desc
   limit greatest(1, least(coalesce(page_limit, 20), 100))
  offset greatest(0, coalesce(page_offset, 0));
$$;

grant execute on function public.list_following(uuid, int, int) to authenticated;
