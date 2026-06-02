-- =========================================================
--  realtime.sql
--  Habilita la publicacion realtime de Supabase en las
--  tablas que el frontend escucha.
--  Idempotente: comprueba antes de anadir.
-- =========================================================

do $$
declare
  t text;
  tables text[] := array[
    'messages',
    'conversations',
    'conversation_participants',
    'social_posts',
    'social_post_likes',
    'social_post_comments',
    'follows'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end$$;
