# Changelog — GAMESTAT

Formato basado en [Keep a Changelog](https://keepachangelog.com/) y SemVer.

## [Unreleased]

### Pendiente
- AuthService unit tests con mock de NavController.
- Adopción exhaustiva de `UserAvatarComponent` / `RatingStarsComponent` en todas las páginas.
- Generación de icono / splash con `@capacitor/assets`.

## [0.8.0] — 2026-05-27 — *Hardening + docs*

### Added
- `karma.conf.js` con custom launcher `ChromeHeadlessNoSandbox` para CI.
- Specs unitarios: `TimeAgoPipe`, `FollowService.getStats`, `SocialService.toggleLike`, `OfflineQueueService`, `UserAvatarComponent`, `RatingStarsComponent`, `EmptyStateComponent`.
- `SupabaseServiceMock` reutilizable en `src/testing/`.
- Documentación completa en `docs/` (ARCHITECTURE, DATA-MODEL, SECURITY, SCHEDULE, BUDGET, USER-MANUAL, PLATFORMS).
- Script `npm run apk:release`.

### Security
- CSP estricta + cabeceras HTTP (`X-Frame-Options`, `Referrer-Policy`, HSTS, Permissions-Policy) en `vercel.json`.

## [0.7.0] — 2026-05-26 — *Capacitor multimedia*

### Added
- Plugins `@capacitor/status-bar`, `@capacitor/keyboard`, `@capacitor/haptics`, `@capacitor/share`, `@capacitor/app`.
- `PlatformService` (haptics + share + clipboard fallback).
- Manejo de hardware back button en `AppComponent` (cierra overlays / `location.back()` / `exitApp`).
- Configuración de `capacitor.config.ts` (`androidScheme: 'https'`, plugins, splash).

## [0.6.0] — 2026-05-25 — *Sociales avanzadas*

### Added
- `<ion-infinite-scroll>` en `FeedPage` con cursor de fecha.
- Animaciones `fadeInUp` en tarjetas del feed.
- `ReviewStatsCardComponent` con distribución 1-10 en barras y media.
- Sección "Seguidores / Siguiendo" en `ProfilePage` con paginación.

## [0.5.0] — 2026-05-22 — *CI/CD + entornos*

### Added
- Workflows `ci.yml`, `deploy-web.yml`, `build-android.yml`.
- Separación de `environment.local.ts` (gitignored) + `.env.example`.

### Changed
- `environment.ts` y `environment.prod.ts` ya no contienen claves.

## [0.4.0] — 2026-05-18 — *Chat robusto*

### Added
- Refactor de `ChatService` a las RPCs `get_user_conversations`, `get_conversation_messages`, `mark_conversation_read`.
- Edición de mensajes propios.
- Indicador "escribiendo…" vía presence.
- UI completa de gestión de grupos (promote / remove / leave / add) con búsqueda de perfiles.
- RPC `promote_group_member`.

## [0.3.0] — 2026-05-12 — *Offline-first*

### Added
- `NetworkService` con signal `online`.
- `OfflineQueueService` con persistencia en `Preferences` + backoff exponencial.
- Integración en `ChatService.sendMessage`, `SocialService.createPost` y `toggleLike`.
- Banner global de offline.

## [0.2.0] — 2026-04-28 — *Componentes compartidos*

### Added
- `UserAvatarComponent`, `RatingStarsComponent`, `EmptyStateComponent`.
- Pipe `timeAgo`.
- Animación nativa Ionic `pageTransitionAnimation`.

## [0.1.0] — 2026-04-10 — *MVP funcional*

### Added
- Auth (login/register) con Supabase.
- Feed básico, perfil, juegos y reseñas.
- Esquema Postgres inicial + RLS.
