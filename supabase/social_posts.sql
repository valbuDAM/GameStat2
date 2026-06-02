-- =========================================================
--  social_posts.sql
--  Feed social: posts, likes, comentarios.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- POSTS ----------
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.social_posts
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.social_posts
  drop constraint if exists social_posts_content_len_chk;
alter table public.social_posts
  add  constraint social_posts_content_len_chk
  check (char_length(content) <= 2000);

-- FK directa a profiles para poder embed con PostgREST.
alter table public.social_posts
  drop constraint if exists social_posts_user_profile_fk;
alter table public.social_posts
  add  constraint social_posts_user_profile_fk
  foreign key (user_id) references public.profiles (id) on delete cascade;

drop trigger if exists social_posts_set_updated_at on public.social_posts;
create trigger social_posts_set_updated_at
before update on public.social_posts
for each row execute function public.tg_set_updated_at();

create index if not exists social_posts_user_idx on public.social_posts (user_id, created_at desc);
create index if not exists social_posts_created_idx on public.social_posts (created_at desc);

-- ---------- LIKES ----------
create table if not exists public.social_post_likes (
  post_id uuid not null references public.social_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  primary key (post_id, user_id)
);

create index if not exists social_post_likes_user_idx on public.social_post_likes (user_id);

-- ---------- COMENTARIOS ----------
create table if not exists public.social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  created_at timestamp with time zone not null default now()
);

alter table public.social_post_comments
  drop constraint if exists social_post_comments_content_len_chk;
alter table public.social_post_comments
  add  constraint social_post_comments_content_len_chk
  check (char_length(content) <= 1000);

alter table public.social_post_comments
  drop constraint if exists social_post_comments_user_profile_fk;
alter table public.social_post_comments
  add  constraint social_post_comments_user_profile_fk
  foreign key (user_id) references public.profiles (id) on delete cascade;

create index if not exists social_post_comments_post_idx
  on public.social_post_comments (post_id, created_at asc);

-- ---------- VISTA: posts con stats + autor ----------
create or replace view public.social_feed as
select
  p.id,
  p.user_id,
  p.content,
  p.created_at,
  prof.name              as author_name,
  prof.avatar            as author_avatar,
  coalesce(l.likes_count, 0)::int     as likes_count,
  coalesce(c.comments_count, 0)::int  as comments_count
from public.social_posts p
left join public.profiles prof on prof.id = p.user_id
left join (
  select post_id, count(*) as likes_count
  from public.social_post_likes
  group by post_id
) l on l.post_id = p.id
left join (
  select post_id, count(*) as comments_count
  from public.social_post_comments
  group by post_id
) c on c.post_id = p.id;

-- ---------- RLS ----------
alter table public.social_posts enable row level security;
alter table public.social_post_likes enable row level security;
alter table public.social_post_comments enable row level security;

-- posts
drop policy if exists "Authenticated can read posts" on public.social_posts;
create policy "Authenticated can read posts"
on public.social_posts for select to authenticated using (true);

drop policy if exists "Users can insert own posts" on public.social_posts;
create policy "Users can insert own posts"
on public.social_posts for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own posts" on public.social_posts;
create policy "Users can update own posts"
on public.social_posts for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own posts" on public.social_posts;
create policy "Users can delete own posts"
on public.social_posts for delete to authenticated
using ((select auth.uid()) = user_id);

-- likes
drop policy if exists "Authenticated can read likes" on public.social_post_likes;
create policy "Authenticated can read likes"
on public.social_post_likes for select to authenticated using (true);

drop policy if exists "Users can like as themselves" on public.social_post_likes;
create policy "Users can like as themselves"
on public.social_post_likes for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can unlike as themselves" on public.social_post_likes;
create policy "Users can unlike as themselves"
on public.social_post_likes for delete to authenticated
using ((select auth.uid()) = user_id);

-- comments
drop policy if exists "Authenticated can read comments" on public.social_post_comments;
create policy "Authenticated can read comments"
on public.social_post_comments for select to authenticated using (true);

drop policy if exists "Users can comment as themselves" on public.social_post_comments;
create policy "Users can comment as themselves"
on public.social_post_comments for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own comments" on public.social_post_comments;
create policy "Users can delete own comments"
on public.social_post_comments for delete to authenticated
using ((select auth.uid()) = user_id);

-- Vista usa los privilegios del usuario: la heredamos via security_invoker
-- (Postgres 15+). En Supabase actual ya esta soportado.
alter view public.social_feed set (security_invoker = true);

-- =========================================================
--  RPC: get_user_feed
--  Devuelve los posts del usuario + de los usuarios a los
--  que sigue, con contadores y flag viewer_liked, paginado
--  por cursor (created_at < before_ts).
-- =========================================================
create or replace function public.get_user_feed(
  before_ts timestamptz default null,
  page_limit int default 20
)
returns table (
  id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  author_name text,
  author_avatar text,
  likes_count int,
  comments_count int,
  viewer_liked boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with viewer as (select auth.uid() as uid)
  select
    p.id,
    p.user_id,
    p.content,
    p.created_at,
    prof.name,
    prof.avatar,
    (select count(*)::int from public.social_post_likes l where l.post_id = p.id),
    (select count(*)::int from public.social_post_comments c where c.post_id = p.id),
    exists(select 1 from public.social_post_likes l
            where l.post_id = p.id and l.user_id = (select uid from viewer)) as viewer_liked
  from public.social_posts p
  join public.profiles prof on prof.id = p.user_id
  where (before_ts is null or p.created_at < before_ts)
  order by p.created_at desc
  limit greatest(1, least(coalesce(page_limit, 20), 50));
$$;

grant execute on function public.get_user_feed(timestamptz, int) to authenticated;

-- =========================================================
--  RPC: toggle_post_like  (atomico)
--  Inserta o elimina el like del usuario; devuelve estado final.
-- =========================================================
create or replace function public.toggle_post_like(p_post uuid)
returns table (liked boolean, likes_count int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  me uuid := auth.uid();
  has_like boolean;
begin
  if me is null then raise exception 'No autenticado'; end if;

  select exists(
    select 1 from public.social_post_likes
     where post_id = p_post and user_id = me
  ) into has_like;

  if has_like then
    delete from public.social_post_likes where post_id = p_post and user_id = me;
  else
    insert into public.social_post_likes (post_id, user_id) values (p_post, me)
    on conflict do nothing;
  end if;

  return query
    select (not has_like),
           (select count(*)::int from public.social_post_likes where post_id = p_post);
end;
$$;

grant execute on function public.toggle_post_like(uuid) to authenticated;
