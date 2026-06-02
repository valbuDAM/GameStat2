# Manual de usuario — GAMESTAT

> Las capturas referenciadas (`docs/screens/*.png`) pueden añadirse posteriormente. Las rutas indicadas son los nombres sugeridos.

## 1. Registro e inicio de sesión

1. Abre la app (Web o Android).
2. Pulsa **Crear cuenta** en la pantalla inicial.
3. Introduce email, contraseña (mín. 6 caracteres) y nombre público.
4. Recibirás un correo de confirmación si tu proyecto Supabase lo exige.
5. Vuelve a la app e inicia sesión.

![Login](screens/login.png)

## 2. Feed

- Pestaña **Inicio**. Se cargan los últimos posts por orden cronológico.
- Pulsa el corazón para dar like (animación + haptic).
- Pulsa el bocadillo para comentar.
- **Compartir** copia el enlace o usa la API nativa Share.
- Desliza hacia abajo para refrescar; scroll infinito al llegar al final.

![Feed](screens/feed.png)

## 3. Perfil

- Pestaña **Perfil**: tu información, tus reseñas y tus posts.
- Pulsa **Seguidores** o **Siguiendo** para ver la lista paginada.
- Botón ⚙ para editar nombre, biografía y avatar.

![Perfil](screens/profile.png)

## 4. Buscar perfiles

- Pestaña **Usuarios**. Escribe el nombre; búsqueda fuzzy con resultados ordenados por relevancia.

## 5. Reseñar un juego

1. Pestaña **Juegos**. Busca por nombre.
2. Entra en la ficha del juego.
3. Pulsa **Reseñar** y rellena rating (1-10) + título + comentario.
4. Tu reseña aparece en la ficha y en tu perfil, y actualiza la distribución `ReviewStatsCard`.

![Ficha juego](screens/game.png)

## 6. Chat

- Pestaña **Mensajes**. Lista de conversaciones con badge de no leídos.
- Pulsa una conversación para abrir el detalle.
- `Enter` envía; `Shift+Enter` salto de línea.
- Mensajes propios se pueden editar (pulsación larga).
- Para grupos: icono ⋯ → gestionar miembros (añadir, promover a admin, expulsar, salir del grupo).

![Chat](screens/chat.png)

## 7. Estado offline

- Si pierdes conexión, un banner aparece en la parte superior.
- Likes, posts y mensajes quedan en cola y se enviarán al volver la conexión (hasta 5 reintentos).
- Los mensajes en cola se marcan visualmente como `pending`.

