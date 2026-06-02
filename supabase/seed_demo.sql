-- =========================================================
--  seed_demo.sql
--  Datos de demo para probar GameStat.
--
--  IMPORTANTE: este script NO crea usuarios en auth.users.
--  Los usuarios de auth deben crearse desde:
--    Supabase Dashboard -> Authentication -> Users -> Invite/Add User
--  o desde la propia app con register.
--
--  Una vez creados, copia sus UUID y reemplázalos abajo.
-- =========================================================

-- 🔧 Reemplaza estos UUID por los reales de auth.users:
--   psql> select id, email from auth.users;
do $$
declare
  u_iker  uuid := '00000000-0000-0000-0000-000000000001';
  u_marta uuid := '00000000-0000-0000-0000-000000000002';
  u_claud uuid := '00000000-0000-0000-0000-000000000003';
  u_raul  uuid := '00000000-0000-0000-0000-000000000004';
  conv_id uuid;
  post_id uuid;
begin
  -- Solo seedear si los UUIDs existen en auth.users
  if not exists (select 1 from auth.users where id = u_iker) then
    raise notice 'Skipping seed: usuarios demo no existen aun.';
    return;
  end if;

  -- Perfiles (idempotente)
  insert into public.profiles (id, email, name, favorite_game, bio, avatar) values
    (u_iker,  'iker@gamestat.app',   'Iker Demo', 'Valorant',     'Main duelist',     'ID'),
    (u_marta, 'marta@gamestat.app',  'Marta',     'League of Legends', 'Support OTP', 'MA'),
    (u_claud, 'claudia@gamestat.app','Claudia',  'EA FC 26',     'Coach amateur',     'CL'),
    (u_raul,  'raul@gamestat.app',   'Raul',     'Counter-Strike','Caster',           'RA')
  on conflict (id) do update
    set name = excluded.name,
        favorite_game = excluded.favorite_game,
        bio = excluded.bio,
        avatar = excluded.avatar;

  -- Follows
  insert into public.follows (follower_id, followed_id) values
    (u_iker, u_marta),
    (u_iker, u_claud),
    (u_marta, u_iker),
    (u_claud, u_iker)
  on conflict do nothing;

  -- Posts del feed
  insert into public.social_posts (user_id, content) values
    (u_marta, 'Quien se apunta a scrim esta noche? Necesitamos support.'),
    (u_iker,  'He subido nueva review del parche. El balance esta mucho mejor.'),
    (u_claud, 'Busco duo para subir rank esta tarde.'),
    (u_raul,  'El evento nuevo deja recompensas bastante buenas.');

  -- Reviews
  insert into public.game_reviews (user_id, rawg_id, game, title, comment, rating, author) values
    (u_iker, 323229, 'Valorant', 'Shooter muy fino', 'Buen ritmo competitivo y partidas muy agiles.', 9, 'Iker Demo'),
    (u_claud, null,  'EA FC 26', 'Online bastante mejor', 'Mejor online, aunque aun depende mucho del meta.', 8, 'Claudia')
  on conflict do nothing;

  -- Conversacion grupal
  insert into public.conversations (type, title, created_by) values
    ('group', 'Equipo Ranked', u_iker)
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role) values
    (conv_id, u_iker, 'admin'),
    (conv_id, u_marta, 'member'),
    (conv_id, u_claud, 'member'),
    (conv_id, u_raul, 'member');

  insert into public.messages (conversation_id, sender_id, content) values
    (conv_id, u_raul,  'Subid builds para revisar antes del torneo.'),
    (conv_id, u_claud, 'Yo llevo el draft y el scouting.'),
    (conv_id, u_iker,  'Vamos arriba, esta noche scrim a las 21:00.');

  -- Chat privado iker <-> marta
  insert into public.conversations (type, created_by) values ('private', u_iker)
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id, role) values
    (conv_id, u_iker, 'member'),
    (conv_id, u_marta, 'member');

  insert into public.messages (conversation_id, sender_id, content) values
    (conv_id, u_marta, 'Entramos a jugar a las 21:00?'),
    (conv_id, u_iker,  'Si, te paso link de la sala.');
end $$;
