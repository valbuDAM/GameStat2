-- =========================================================
--  chat.sql
--  Conversaciones privadas y grupales + mensajes.
--
--  Decisión arquitectónica:
--    Una única tabla `conversations` con un campo `type`
--    ('private' | 'group').  Razones:
--      * Mismas operaciones (listar, enviar, suscribirse).
--      * Reusa una sola tabla de mensajes y participantes.
--      * Soporta promover una conversación privada a grupal
--        en el futuro sin migrar datos.
--      * Menos joins en realtime.
--
--  Para evitar conversaciones privadas duplicadas usamos una
--  RPC SECURITY DEFINER `get_or_create_private_conversation`
--  que comprueba primero si ya existe una entre ambos usuarios.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- TABLAS ----------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('private', 'group')),
  title text,
  avatar text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamp with time zone not null default now(),
  last_message_at timestamp with time zone not null default now()
);

create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamp with time zone not null default now(),
  last_read_at timestamp with time zone not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_participants
  add column if not exists last_read_at timestamp with time zone not null default now();

create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  content text not null check (length(trim(content)) > 0 and char_length(content) <= 4000),
  created_at timestamp with time zone not null default now(),
  edited_at timestamp with time zone
);

alter table public.messages
  add column if not exists edited_at timestamp with time zone;

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at asc);
create index if not exists messages_conversation_desc_idx
  on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_idx
  on public.messages (sender_id, created_at desc);

-- ---------- TRIGGER: bump last_message_at ----------
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_on_message();

-- ---------- HELPER SECURITY DEFINER ----------
-- Evita recursión en políticas RLS de conversation_participants.
create or replace function public.is_conversation_member(conv uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.conversation_participants
     where conversation_id = conv and user_id = uid
  );
$$;

grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

create or replace function public.is_conversation_admin(conv uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.conversation_participants
     where conversation_id = conv
       and user_id = uid
       and role = 'admin'
  );
$$;

grant execute on function public.is_conversation_admin(uuid, uuid) to authenticated;

-- ---------- RPCs ----------

-- Devuelve la conversación privada entre auth.uid() y other_user.
-- Si no existe la crea. Idempotente.
create or replace function public.get_or_create_private_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv_id uuid;
begin
  if me is null then
    raise exception 'No autenticado';
  end if;
  if other_user is null or other_user = me then
    raise exception 'other_user invalido';
  end if;

  -- Buscar conversacion privada que tenga EXACTAMENTE estos dos miembros
  select c.id into conv_id
    from public.conversations c
   where c.type = 'private'
     and exists (
       select 1 from public.conversation_participants p
        where p.conversation_id = c.id and p.user_id = me
     )
     and exists (
       select 1 from public.conversation_participants p
        where p.conversation_id = c.id and p.user_id = other_user
     )
     and (
       select count(*) from public.conversation_participants p
        where p.conversation_id = c.id
     ) = 2
   limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  insert into public.conversations (type, created_by)
       values ('private', me)
    returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
       values (conv_id, me, 'member'),
              (conv_id, other_user, 'member');

  return conv_id;
end;
$$;

grant execute on function public.get_or_create_private_conversation(uuid) to authenticated;

-- Crea un grupo con auth.uid() como admin y los member_ids extra como miembros.
create or replace function public.create_group_conversation(
  p_title text,
  p_avatar text,
  member_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv_id uuid;
  member uuid;
begin
  if me is null then
    raise exception 'No autenticado';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'El titulo del grupo es obligatorio';
  end if;

  insert into public.conversations (type, title, avatar, created_by)
       values ('group', trim(p_title), nullif(trim(coalesce(p_avatar, '')), ''), me)
    returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
       values (conv_id, me, 'admin');

  if member_ids is not null then
    foreach member in array member_ids loop
      if member is not null and member <> me then
        insert into public.conversation_participants (conversation_id, user_id, role)
             values (conv_id, member, 'member')
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return conv_id;
end;
$$;

grant execute on function public.create_group_conversation(text, text, uuid[]) to authenticated;

-- Solo admins pueden añadir miembros a un grupo
create or replace function public.add_group_member(conv_id uuid, new_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv_type text;
begin
  if me is null then raise exception 'No autenticado'; end if;
  select type into conv_type from public.conversations where id = conv_id;
  if conv_type is null then raise exception 'Conversacion inexistente'; end if;
  if conv_type <> 'group' then raise exception 'Solo se pueden agregar miembros a grupos'; end if;

  if not public.is_conversation_admin(conv_id, me) then
    raise exception 'Solo administradores pueden agregar miembros';
  end if;

  insert into public.conversation_participants (conversation_id, user_id, role)
       values (conv_id, new_user, 'member')
  on conflict do nothing;
end;
$$;

grant execute on function public.add_group_member(uuid, uuid) to authenticated;

-- Quitar miembro: admins pueden quitar a cualquiera; los usuarios pueden
-- abandonar el grupo a si mismos.
create or replace function public.remove_group_member(conv_id uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'No autenticado'; end if;

  if target_user <> me and not public.is_conversation_admin(conv_id, me) then
    raise exception 'No tienes permisos';
  end if;

  delete from public.conversation_participants
   where conversation_id = conv_id and user_id = target_user;
end;
$$;

grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

-- Promueve un miembro a admin. Solo admins pueden hacerlo. No degrada admins
-- existentes (es idempotente: si ya es admin no falla).
create or replace function public.promote_group_member(conv_id uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv_type text;
begin
  if me is null then raise exception 'No autenticado'; end if;
  select type into conv_type from public.conversations where id = conv_id;
  if conv_type is null then raise exception 'Conversacion inexistente'; end if;
  if conv_type <> 'group' then raise exception 'Solo grupos tienen administradores'; end if;

  if not public.is_conversation_admin(conv_id, me) then
    raise exception 'Solo administradores pueden promover miembros';
  end if;

  update public.conversation_participants
     set role = 'admin'
   where conversation_id = conv_id
     and user_id = target_user;

  if not found then
    raise exception 'El usuario no es miembro de este grupo';
  end if;
end;
$$;

grant execute on function public.promote_group_member(uuid, uuid) to authenticated;

-- =========================================================
--  RPC: get_user_conversations
--  Lista las conversaciones del usuario con metadata util
--  (ultimo mensaje, mensajes sin leer, otro participante en
--  privadas) en UNA sola query.  Resuelve el N+1 del cliente.
-- =========================================================
create or replace function public.get_user_conversations()
returns table (
  id uuid,
  type text,
  title text,
  avatar text,
  last_message_at timestamptz,
  last_message_content text,
  last_message_sender uuid,
  unread_count int,
  member_count int,
  other_user_id uuid,
  other_user_name text,
  other_user_avatar text
)
language sql
stable
security invoker
set search_path = public
as $$
  with me as (select auth.uid() as uid)
  select
    c.id,
    c.type,
    c.title,
    c.avatar,
    c.last_message_at,
    lm.content,
    lm.sender_id,
    (select count(*)::int from public.messages m
       where m.conversation_id = c.id
         and m.created_at > p.last_read_at
         and m.sender_id <> (select uid from me)) as unread_count,
    (select count(*)::int from public.conversation_participants pp
       where pp.conversation_id = c.id) as member_count,
    ou.id, ou.name, ou.avatar
  from public.conversations c
  join public.conversation_participants p
       on p.conversation_id = c.id and p.user_id = (select uid from me)
  left join lateral (
    select content, sender_id
      from public.messages m
     where m.conversation_id = c.id
     order by m.created_at desc
     limit 1
  ) lm on true
  left join lateral (
    select pr.id, pr.name, pr.avatar
      from public.conversation_participants pp
      join public.profiles pr on pr.id = pp.user_id
     where pp.conversation_id = c.id
       and pp.user_id <> (select uid from me)
       and c.type = 'private'
     limit 1
  ) ou on true
  order by c.last_message_at desc;
$$;

grant execute on function public.get_user_conversations() to authenticated;

-- =========================================================
--  RPC: get_conversation_messages  (paginado por cursor)
-- =========================================================
create or replace function public.get_conversation_messages(
  conv_id uuid,
  before_ts timestamptz default null,
  page_limit int default 50
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  content text,
  created_at timestamptz,
  edited_at timestamptz,
  sender_name text,
  sender_avatar text
)
language sql
stable
security invoker
set search_path = public
as $$
  select m.id, m.conversation_id, m.sender_id, m.content, m.created_at, m.edited_at,
         p.name, p.avatar
    from public.messages m
    left join public.profiles p on p.id = m.sender_id
   where m.conversation_id = conv_id
     and public.is_conversation_member(conv_id, auth.uid())
     and (before_ts is null or m.created_at < before_ts)
   order by m.created_at desc
   limit greatest(1, least(coalesce(page_limit, 50), 200));
$$;

grant execute on function public.get_conversation_messages(uuid, timestamptz, int) to authenticated;

-- =========================================================
--  RPC: mark_conversation_read
-- =========================================================
create or replace function public.mark_conversation_read(conv_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  update public.conversation_participants
     set last_read_at = now()
   where conversation_id = conv_id and user_id = auth.uid();
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ---------- RLS ----------
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- conversations: solo miembros pueden leer
drop policy if exists "Members can read conversations" on public.conversations;
create policy "Members can read conversations"
on public.conversations for select to authenticated
using (public.is_conversation_member(id, (select auth.uid())));

-- conversations: inserts/updates pasan por RPC (no se permiten directos)
-- Pero dejamos al creador actualizar titulo/avatar
drop policy if exists "Creator can update conversation" on public.conversations;
create policy "Creator can update conversation"
on public.conversations for update to authenticated
using (public.is_conversation_admin(id, (select auth.uid())))
with check (public.is_conversation_admin(id, (select auth.uid())));

-- conversation_participants: miembros pueden leer la lista de su conversacion
drop policy if exists "Members can read participants" on public.conversation_participants;
create policy "Members can read participants"
on public.conversation_participants for select to authenticated
using (
  public.is_conversation_member(conversation_id, (select auth.uid()))
  or user_id = (select auth.uid())
);

-- No exponemos insert/update/delete directos: se gestionan via RPC.
-- (Si quieres permitir auto-leave sin RPC, puedes añadir DELETE policy
--  con user_id = auth.uid()).
drop policy if exists "Users can leave conversation" on public.conversation_participants;
create policy "Users can leave conversation"
on public.conversation_participants for delete to authenticated
using (user_id = (select auth.uid()));

-- messages
drop policy if exists "Members can read messages" on public.messages;
create policy "Members can read messages"
on public.messages for select to authenticated
using (public.is_conversation_member(conversation_id, (select auth.uid())));

drop policy if exists "Members can send messages" on public.messages;
create policy "Members can send messages"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and public.is_conversation_member(conversation_id, (select auth.uid()))
);

drop policy if exists "Senders can edit own messages" on public.messages;
create policy "Senders can edit own messages"
on public.messages for update to authenticated
using (sender_id = (select auth.uid()))
with check (sender_id = (select auth.uid()));

drop policy if exists "Senders can delete own messages" on public.messages;
create policy "Senders can delete own messages"
on public.messages for delete to authenticated
using (sender_id = (select auth.uid()));

-- =========================================================
--  FKs adicionales a public.profiles
--  PostgREST necesita un foreign key DIRECTO entre tablas
--  para resolver embeds tipo  select=...,profiles(name,avatar)
--  Como user_id / sender_id apuntan a auth.users y no a
--  profiles, sin estas FKs Supabase devuelve:
--    "Could not find a relationship between '...' and 'profiles'
--     in the schema cache"
--  profiles.id == auth.users.id (1-a-1), asi que la FK es segura.
-- =========================================================

alter table public.conversation_participants
  drop constraint if exists conversation_participants_user_profile_fk;
alter table public.conversation_participants
  add  constraint conversation_participants_user_profile_fk
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.messages
  drop constraint if exists messages_sender_profile_fk;
alter table public.messages
  add  constraint messages_sender_profile_fk
  foreign key (sender_id) references public.profiles (id) on delete set null;

-- Forzar a PostgREST a recargar el schema cache
notify pgrst, 'reload schema';
