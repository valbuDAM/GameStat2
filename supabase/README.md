# Supabase migrations

Ejecuta estos scripts en el SQL editor de Supabase, en este orden:

1. `00_extensions.sql` — Extensiones (`pgcrypto`, `pg_trgm`, `citext`).
2. `_shared.sql` — Funciones genericas (`tg_set_updated_at`).
3. `profiles.sql` — Tabla `profiles`, trigger de alta y RPC `search_profiles`.
4. `rawg_games.sql` — Cache de juegos RAWG + favoritos (RLS restrictiva).
5. `game_reviews.sql` — Reviews + RPCs `get_review_stats`, `get_user_review_stats`.
6. `follows.sql` — Follows + RPCs `is_following`, `get_follow_counts`, `list_followers`, `list_following`.
7. `social_posts.sql` — Posts/likes/comentarios + RPCs `get_user_feed`, `toggle_post_like`.
8. `chat.sql` — Conversaciones + mensajes + RPCs (`get_user_conversations`, `get_conversation_messages`, `mark_conversation_read`, gestion de grupos).
9. `realtime.sql` — Habilita publicacion realtime (idempotente).
10. `seed_demo.sql` — (Opcional) Usuarios demo + datos de prueba.

Todos los scripts son **idempotentes**: pueden re-ejecutarse sin perder datos.

## Arquitectura DB (resumen)

| Tabla / Vista                     | Proposito                                       |
| --------------------------------- | ----------------------------------------------- |
| `profiles`                        | Perfil publico del usuario (1-a-1 con auth)     |
| `follows`                         | Relacion follower -> followed                   |
| `social_posts`                    | Posts del feed                                  |
| `social_post_likes`               | Likes por post / usuario                        |
| `social_post_comments`            | Comentarios anidados a un post                  |
| `social_feed` (vista)             | Posts con contador de likes y autor             |
| `conversations`                   | Conversacion privada o grupal                   |
| `conversation_participants`       | Miembros + `last_read_at` para unread badges    |
| `messages`                        | Mensajes de chat (con `edited_at`)              |
| `game_reviews`                    | Reviews de juegos (1 por usuario y `rawg_id`)   |
| `rawg_games` / `favorite_games`   | Cache RAWG y favoritos por usuario              |

## RPCs disponibles

### Perfiles / social
* `search_profiles(q text, max_results int) -> setof`
* `is_following(target uuid) -> boolean`
* `get_follow_counts(target uuid) -> (followers_count, following_count)`
* `list_followers(target uuid, limit, offset) -> setof`
* `list_following(target uuid, limit, offset) -> setof`
* `get_user_feed(before_ts timestamptz, page_limit int) -> setof`
* `toggle_post_like(post_id uuid) -> (liked, likes_count)`

### Reviews
* `get_review_stats(rawg_id bigint) -> (total, avg, distribucion 1..10)`
* `get_user_review_stats(user_id uuid) -> (total, avg, last_review_at)`

### Chat
* `get_or_create_private_conversation(other_user uuid) -> uuid`
* `create_group_conversation(title, avatar, member_ids uuid[]) -> uuid`
* `add_group_member(conv_id, new_user) -> void`
* `remove_group_member(conv_id, target_user) -> void`
* `get_user_conversations() -> setof` (con last message, unread, otro participante)
* `get_conversation_messages(conv_id, before_ts, page_limit) -> setof`
* `mark_conversation_read(conv_id) -> void`

## Seguridad

* RLS activa en **todas** las tablas.
* Politicas optimizadas con `(select auth.uid())` (cacheado por query).
* Funciones de gestion de chat son `SECURITY DEFINER` para evitar recursion en RLS.
* RPCs de lectura son `SECURITY INVOKER` -> heredan RLS del usuario.
* `rawg_games`: cache compartida solo permite INSERT/UPDATE; DELETE reservado a `service_role`.
