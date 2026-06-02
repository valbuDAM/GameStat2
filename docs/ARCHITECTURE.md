# Arquitectura — GAMESTAT

## 1. Visión general

GAMESTAT es una red social ligera para reseñar y comentar videojuegos. La aplicación se distribuye como **PWA Ionic + Angular** desplegada en Vercel y como **APK Android** generada con Capacitor. El backend es **Supabase** (Postgres + Auth + Realtime + Storage) sin servidor propio.

## 2. Contexto (C4 nivel 1)

```mermaid
C4Context
    title GAMESTAT — Diagrama de contexto
    Person(user, "Jugador", "Reseña y comenta juegos")
    System(gamestat, "GAMESTAT", "App Ionic+Angular (Web/Android)")
    System_Ext(supabase, "Supabase", "Auth + Postgres + Realtime")
    System_Ext(rawg, "RAWG API", "Catálogo de videojuegos")
    System_Ext(vercel, "Vercel", "Hosting estático PWA")

    Rel(user, gamestat, "Usa", "HTTPS")
    Rel(gamestat, supabase, "REST + Realtime", "HTTPS / WSS")
    Rel(gamestat, rawg, "Consulta catálogo", "HTTPS")
    Rel(gamestat, vercel, "Servido desde", "HTTPS")
```

## 3. Contenedores (C4 nivel 2)

```mermaid
C4Container
    title GAMESTAT — Contenedores
    Person(user, "Jugador")
    System_Boundary(gs, "GAMESTAT") {
        Container(web, "PWA Web", "Angular 17 + Ionic 8", "SPA standalone components")
        Container(android, "Android Shell", "Capacitor 7", "WebView + plugins nativos")
    }
    System_Boundary(sb, "Supabase") {
        ContainerDb(pg, "Postgres", "PostgreSQL 15", "Datos + RLS + RPCs")
        Container(auth, "GoTrue Auth", "JWT", "Email + OAuth")
        Container(rt, "Realtime", "Phoenix Channels", "WebSocket")
    }
    Container_Ext(rawg, "RAWG API")

    Rel(user, web, "Usa")
    Rel(user, android, "Usa")
    Rel(web, auth, "Login/Register")
    Rel(web, pg, "REST + RPC")
    Rel(web, rt, "Suscribe canales")
    Rel(android, auth, "Login")
    Rel(android, pg, "REST + RPC")
    Rel(web, rawg, "Buscar juegos")
```

## 4. Componentes Angular (C4 nivel 3, vista parcial)

```mermaid
flowchart TB
    subgraph pages
      Feed[FeedPage]
      Chat[ChatDetailPage]
      Profile[ProfilePage]
      Game[GamePage]
    end
    subgraph core[core/services]
      Auth[AuthService]
      Social[SocialService]
      ChatS[ChatService]
      Follow[FollowService]
      Reviews[ReviewService]
      OfflineQ[OfflineQueueService]
      Net[NetworkService]
      Platform[PlatformService]
      SupabaseS[SupabaseService]
    end
    subgraph shared[shared/components]
      Avatar[UserAvatarComponent]
      Stars[RatingStarsComponent]
      Empty[EmptyStateComponent]
      StatsCard[ReviewStatsCardComponent]
    end

    Feed --> Social
    Feed --> Avatar
    Chat --> ChatS
    Chat --> Platform
    Profile --> Follow
    Profile --> Reviews
    Game --> Reviews
    Game --> StatsCard
    Social --> SupabaseS
    Social --> OfflineQ
    ChatS --> SupabaseS
    ChatS --> OfflineQ
    OfflineQ --> Net
    Auth --> SupabaseS
```

## 5. Decisiones técnicas

| Decisión | Alternativa descartada | Justificación |
| --- | --- | --- |
| Supabase (BaaS) | NestJS + Postgres propio | Reducir mantenimiento; Auth + RLS + Realtime listos. |
| Angular Signals | RxJS para estado UI | Menos boilerplate, integración nativa Angular 17, sin zonas extra. |
| Standalone components | NgModules | Tree-shaking más agresivo, recomendación oficial Angular. |
| Capacitor 7 | Cordova / React Native | Reutilizar 100% el código web; plugins JS/TS modernos. |
| Vercel | Netlify / GitHub Pages | Despliegues atómicos por commit y previews por PR. |
| Karma + Jasmine | Vitest / Jest | Es el runner por defecto de Angular CLI; cero config extra. |

## 6. Flujos clave

- **Login**: `LoginPage` → `AuthService.login` → `supabase.auth.signInWithPassword` → emite `currentUser` signal → router redirige a `/tabs/feed`.
- **Publicar post**: `FeedPage.publishPost` → `SocialService.createPost` → si online: insert vía RPC; si offline: enqueue en `OfflineQueueService` → flush al volver `online`.
- **Like optimista**: `SocialService.toggleLike` aplica el cambio en UI, llama a `toggle_post_like` (RPC atómica), reconcilia con el valor autoritativo o hace rollback si error.
- **Chat realtime**: `ChatService` se suscribe a postgres_changes en `messages` y presence para "escribiendo…".

## 7. Carpetas

```
src/app/
  core/     # servicios + guardas + modelos compartidos
  shared/   # componentes/pipes reutilizables
  pages/    # rutas (standalone components)
supabase/   # esquema + RLS + RPCs (.sql)
docs/       # documentación TFG
```
