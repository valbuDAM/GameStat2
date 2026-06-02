# GAMESTAT — Pendientes para Nivel 5 (Sobresaliente) en los 7 bloques

Estado a fecha 2026-05-26. Bloques 1, 2 y 3 **completados**. Quedan 4, 5, 6 y 7.

Leyenda: `[ ]` pendiente · `[~]` parcial · `[x]` hecho

---

## ✅ Bloque 1 — Acceso a Datos (Supabase + PostgreSQL) — HECHO

- [x] Extensiones (`pgcrypto`, `pg_trgm`, `citext`) en `supabase/00_extensions.sql`
- [x] Trigger genérico `tg_set_updated_at` en `supabase/_shared.sql`
- [x] `profiles`: `updated_at`, checks de longitud, índice trigram, RPC `search_profiles`
- [x] `follows`: RPCs `is_following`, `get_follow_counts`, `list_followers`, `list_following`
- [x] `game_reviews`: `updated_at`, unique `(user_id, rawg_id)`, FK a `profiles`, RPCs `get_review_stats`, `get_user_review_stats`
- [x] `social_posts`: `updated_at`, FK a `profiles`, RPCs `get_user_feed`, `toggle_post_like`
- [x] `chat`: `last_read_at`, `edited_at`, índices extra, política UPDATE messages, RPCs `get_user_conversations`, `get_conversation_messages`, `mark_conversation_read`
- [x] `rawg_games`: RLS sin DELETE para `authenticated`, check `rating`, trigger `updated_at`
- [x] `realtime.sql` idempotente con `conversation_participants` y `follows`
- [x] README de la BBDD actualizado

> Acción manual pendiente: ejecutar los `.sql` en el SQL Editor de Supabase en el orden del `supabase/README.md`.

---

## ✅ Bloque 2 — Desarrollo de Interfaces (Ionic + Angular) — HECHO (base)

- [x] Componentes reutilizables `app-user-avatar`, `app-rating-stars`, `app-empty-state`
- [x] Pipe `timeAgo`
- [x] Animación nativa Ionic personalizada (`pageTransitionAnimation`) registrada globalmente
- [x] Barrel `src/app/shared/index.ts`

### Pendiente para refinar Nivel 5

- [ ] Adoptar `UserAvatarComponent` en todas las páginas que usen avatares manualmente (`feed.page`, `chat-detail.page`, `social.page`, `profile.page`, `app-header`, `users.page`).
- [ ] Adoptar `RatingStarsComponent` en `review-detail.page`, `review.page` (form) y `game.page`.
- [ ] Adoptar `EmptyStateComponent` en estados vacíos / error de `feed`, `social`, `games`, `users`.
- [ ] Sustituir `formatDate(...)` manual del `SocialService` por `| timeAgo` en plantillas.
- [ ] Auditar **responsive**: probar 360px, 768px, 1024px, 1440px. Ajustar `card-grid` y `page-shell` si rompen.
- [ ] Validación de formularios reactiva con mensajes accesibles (`aria-describedby`) en `login`, `register`, `review` (form).
- [ ] Skeletons de carga (`<ion-skeleton-text>`) en feed, lista de chats y detalle de juego en vez de `ion-spinner` plano.
- [ ] Aplicar `fadeInUp` a las cards del feed cuando aparecen.

---

## ✅ Bloque 3 — Sociales y Reseñas — HECHO (core)

- [x] `social.service` con feed paginado por cursor (`loadFeed`, `loadMoreFeed`, `refreshFeed`)
- [x] `toggle_post_like` atómico en servidor
- [x] Realtime granular (deltas en likes/comments, no recarga total)
- [x] `getReviewStats` y `getUserReviewStats`
- [x] `follow.service` con RPCs + realtime filtrado por `follower_id`
- [x] `profile.service.search` usando RPC `search_profiles`

### Pendiente

- [x] UI de paginación: en `feed.page`, `<ion-infinite-scroll>` que llame a `social.loadMoreFeed()`.
- [x] Componente `ReviewStatsCardComponent` (shared) que pinte la distribución 1-10 con barras y media, y consumirlo en `game.page` y `review-detail.page`.
- [x] Sección "Seguidores / Siguiendo" en `profile.page` consumiendo `follow.listFollowers/listFollowing` con paginación.
- [~] Documentar JSDoc en cada método público de los servicios (entrada, salida, errores).

---

## 🟡 Bloque 4 — Servicios y Procesos (chat robusto)

### 4.1 Refactor de `chat.service.ts` a las nuevas RPCs

- [x] Reemplazar `loadConversations` por una llamada a la RPC `get_user_conversations` (incluye unread, último mensaje y otro participante en una sola query).
- [x] Cargar mensajes con `get_conversation_messages(conv_id, before_ts, page_limit)` y mantener cursor para paginación hacia atrás (scroll-up infinito).
- [x] Llamar a `mark_conversation_read(conv_id)` cuando el usuario abre o vuelve a foco una conversación.
- [x] Exponer `unreadCount` por conversación como `signal` y un `totalUnread = computed(...)` para badges del tab social.
- [x] Soporte a edición de mensajes propios usando la política UPDATE recién añadida (`edited_at`).

### 4.2 Soporte offline

- [x] Instalar `@capacitor/network` y `@capacitor/preferences`.
- [x] Crear `core/services/network.service.ts`: signal `online: Signal<boolean>` alimentado por `Network.addListener('networkStatusChange', ...)` y `Network.getStatus()`.
- [x] Crear `core/services/offline-queue.service.ts`:
  - [x] API: `enqueue(action)`, `flush()`, `pending = signal<...>`.
  - [x] Persistencia con `Preferences.set/get` clave `gamestat.outbox.v1`.
  - [x] Tipos de acción soportados: `send_message`, `create_post`, `toggle_like`.
  - [x] Reintento con backoff exponencial al recuperar conexión.
- [x] Integrar en `chat.service.sendMessage`: si `!network.online()`, enqueue + mostrar el mensaje en UI con estado `pending` y reintento.
- [x] Integrar en `social.service.createPost` y `toggleLike`.
- [x] Banner global en `app.component` cuando `!online` (componente reutilizable `app-offline-banner`).

### 4.3 Accesibilidad y robustez del chat

- [x] Atajos teclado: `Enter` envía, `Shift+Enter` salto de línea.
- [x] `aria-live="polite"` en el contenedor de mensajes para lectores de pantalla.
- [x] Auto-scroll al final solo si el usuario ya estaba al final (evita interrumpir scroll manual).
- [x] Indicador de "escribiendo..." usando `presence` de Supabase Realtime (opcional, valor diferencial).
- [x] Reconexión automática: re-suscribir canales tras volver online (`onAuthStateChange` + reset).

### 4.4 Gestión avanzada de participantes en grupos

- [x] UI de gestión de grupo (`chat-detail.page`): listar miembros con rol, "promote to admin", "remove", "leave group".
- [x] Llamadas a RPCs ya existentes: `add_group_member`, `remove_group_member`.
- [x] Crear RPC adicional `promote_group_member(conv_id, user_id)` en `supabase/chat.sql` (solo admin).
- [x] Crear grupo desde la UI con autocompletado de miembros usando `search_profiles`.

---

## 🟡 Bloque 5 — Seguridad, Infraestructura y Despliegue

### 5.1 Variables de entorno separadas y secrets

- [x] Quitar las keys hardcodeadas de `src/environments/environment.ts` y `environment.prod.ts`. Cargar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RAWG_API_KEY` desde un archivo no comiteado (`environment.local.ts`) y/o variables `process.env.*` inyectadas en build.
- [x] Añadir `environment.local.ts` al `.gitignore`.
- [x] Documentar en `README.md` cómo crear el archivo local.
- [x] Crear `.env.example` con las claves vacías para referencia.
- [ ] **Rotar la anon key actual** (ya está comiteada en git). _(acción manual del usuario en el dashboard de Supabase)_

### 5.2 CI/CD con GitHub Actions

- [x] `.github/workflows/ci.yml`: en cada push/PR → `npm ci` → `npm run lint` → `npm test -- --watch=false --browsers=ChromeHeadless` → `npm run build`.
- [x] `.github/workflows/deploy-web.yml`: en push a `main` → build → deploy a Vercel (token en secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).
- [x] `.github/workflows/build-android.yml`: en push a tags `v*` → `npm run build` → `cap sync android` → `./gradlew assembleRelease` → subir APK como artifact (firmado con keystore en secrets).
- [x] Badges de estado de los workflows en `README.md`.

### 5.3 Tests automatizados

- [x] Configurar Karma+Jasmine ya presente y añadir mocks de `SupabaseService` (clase fake con `client = stub`).
- [~] Unit tests prioritarios:
  - [ ] `AuthService` (login, register, mapAuthError, logout). _(pendiente — depende de NavController/Router mock complejo)_
  - [x] `SocialService.toggleLike` (optimista + rollback + reconciliación).
  - [x] `FollowService.getStats` (RPCs).
  - [x] `OfflineQueueService` (enqueue, flush, persistencia).
  - [x] `TimeAgoPipe`.
- [x] Tests de componente:
  - [x] `UserAvatarComponent` (URL vs iniciales).
  - [x] `RatingStarsComponent` (readonly vs interactivo, emit).
  - [x] `EmptyStateComponent` (variantes + CTA).
- [ ] Cobertura mínima 70% global / 80% en `core/services`. _(configurado reporter; validar tras añadir más specs)_
- [ ] (Opcional) Cypress o Playwright para 2-3 flujos E2E: login, publicar post, enviar mensaje.

### 5.4 Despliegue producción

- [x] Proyecto creado en Vercel con dominio HTTPS (verificar `vercel.json`).
- [x] CSP headers en `vercel.json` (`Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).
- [ ] Confirmar RLS activa en producción mediante el dashboard de Supabase ("Database → Tables → RLS enabled" en todas). _(acción manual)_
- [x] Documentar en `docs/SECURITY.md` la política de seguridad (RLS, JWT, secrets, threat model abreviado).

---

## 🟡 Bloque 6 — Programación Multimedia y Móviles (Capacitor / Android)

- [x] `capacitor.config.ts`: verificar `appId`, `appName`, `webDir: 'www'`, `server.androidScheme: 'https'`.
- [ ] Generar icono y splash con `@capacitor/assets`: `npx @capacitor/assets generate --android` a partir de un `assets/icon.png` y `assets/splash.png`. _(requiere assets gráficos)_
- [x] Plugins Capacitor:
  - [x] `@capacitor/status-bar` (color de la barra coherente con el tema).
  - [x] `@capacitor/keyboard` (ajuste de viewport al abrir teclado en el chat).
  - [x] `@capacitor/haptics` (feedback al dar like / enviar mensaje).
  - [x] `@capacitor/share` (compartir review/post fuera de la app).
- [x] Hardware back button → cerrar modales / volver dentro del stack del router.
- [x] Comprobar safe-area-insets en Android 14+ (`env(safe-area-inset-*)`) en `tabs.page.scss` y `app-header`.
- [ ] Probar APK release firmado en al menos 2 densidades distintas (mdpi/xxhdpi). _(acción manual)_
- [x] Documentar diferencias intencionadas entre Web y Android (si las hay) en `docs/PLATFORMS.md`.
- [x] Script `npm run apk:release` (en `package.json`) que haga build + sync + assembleRelease.

---

## 🟡 Bloque 7 — Documentación y Gestión

Crear carpeta `docs/` con:

- [x] `docs/ARCHITECTURE.md` — diagramas C4 (contexto, contenedores, componentes) en Mermaid + decisiones técnicas justificadas (BaaS vs backend propio, signals vs RxJS, etc.).
- [x] `docs/DATA-MODEL.md` — diagrama ER + descripción de cada tabla, política RLS y RPC en lenguaje natural.
- [x] `docs/SECURITY.md` — RLS, JWT, secrets, dependencias auditadas (`npm audit`), CSP.
- [x] `docs/SCHEDULE.md` — cronograma del TFG (Gantt en Mermaid) con hitos y horas estimadas vs reales.
- [x] `docs/BUDGET.md` — presupuesto (horas × tarifa) y costes mensuales reales (Supabase free, Vercel free, dominio, Play Store).
- [x] `docs/CHANGELOG.md` — historial de versiones desde v0.1 hasta la entrega.
- [x] `docs/USER-MANUAL.md` — manual de usuario con capturas (registro, feed, chat, perfil).
- [x] `README.md` raíz: pulir con badges, screenshots, "Getting started", "Stack", enlaces a `docs/`.

---

## 📋 Orden sugerido para próximas sesiones

1. **Bloque 4.1** (refactor chat a RPCs) — 1 sesión.
2. **Bloque 4.2** (offline queue + network service) — 1 sesión.
3. **Bloque 4.3 + 4.4** (UX chat, grupos) — 1 sesión.
4. **Bloque 5.1** (rotar key + envs separadas) — urgente, 30 min.
5. **Bloque 5.2** (CI/CD) — 1 sesión.
6. **Bloque 5.3** (tests) — 1-2 sesiones.
7. **Bloque 6** (Capacitor) — 1 sesión.
8. **Bloque 7** (documentación) — 1 sesión final.

---

## ⚠️ Acciones críticas y de seguridad inmediatas

- [ ] **Rotar `SUPABASE_ANON_KEY`** desde el dashboard (clave actual comiteada en repo público).
- [ ] Ejecutar todos los `.sql` actualizados en Supabase para activar las nuevas RPCs e índices.
- [ ] Si el proyecto es público en GitHub: revisar histórico con `git log -p -- src/environments/environment.ts` y considerar `git filter-repo` para limpiar la clave antigua del histórico.
