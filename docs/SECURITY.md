# Seguridad — GAMESTAT

## 1. Modelo de amenazas (abreviado)

| Activo | Amenaza | Mitigación |
| --- | --- | --- |
| JWT del usuario | Robo (XSS, extensión maliciosa) | CSP estricta, sin `eval` en código propio, `frame-ancestors 'none'`. |
| Datos personales | Lectura indebida cross-user | RLS en todas las tablas; RPCs con `SECURITY DEFINER` y filtros explícitos. |
| Chat privado | Lectura por terceros | Política RLS: solo participantes ven mensajes; INSERT solo `sender_id = auth.uid()`. |
| Credenciales backend | Filtración en repo | Anon key en `environment.local.ts` (gitignored). Rotación manual obligatoria. |
| Tokens RAWG / Vercel | Reutilización | Almacenados en GitHub Secrets, nunca en código. |
| Dependencias npm | Vulnerabilidades conocidas | `npm audit` periódico en CI (recomendado). |

## 2. Row Level Security

Todas las tablas tienen `ENABLE ROW LEVEL SECURITY` activado. Políticas resumidas:

- **SELECT público** en `profiles`, `follows`, `social_posts`, `social_post_likes`, `social_post_comments`, `game_reviews`.
- **INSERT/UPDATE/DELETE** únicamente sobre filas cuyo `user_id = auth.uid()`.
- **`messages` y `conversations`**: SELECT solo si el usuario aparece en `conversation_participants`.
- **`rawg_games`**: SELECT y UPSERT autenticado; **sin DELETE**.

Operaciones que cruzan dominios (añadir/quitar/promover miembros, marcar leído, feed por cursor) se canalizan por **RPCs `SECURITY DEFINER`** con validación interna (`raise exception` si no admin, etc.). Ningún cliente puede saltarse RLS con queries directas.

## 3. Autenticación

- Supabase Auth (GoTrue) con JWT firmado por el proyecto.
- Tokens guardados por la librería oficial `@supabase/supabase-js` en `localStorage` (web) y `Capacitor Preferences` (Android).
- `AuthService` escucha `onAuthStateChange` y propaga al signal `currentUser`. Las guardas (`authGuard`, `guestGuard`) protegen rutas.
- Errores normalizados a mensajes legibles en español (`mapAuthError`).

## 4. Secretos y configuración

- `src/environments/environment.local.ts` (gitignored): contiene `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RAWG_API_KEY`.
- `.env.example` documenta las variables necesarias.
- **Rotación obligatoria** de la anon key tras descubrir que estaba histórica en git (`git filter-repo` recomendado para limpiar el histórico).
- En CI/CD las claves se inyectan desde GitHub Secrets reconstruyendo `environment.local.ts` justo antes del build.

## 5. CSP y cabeceras HTTP (`vercel.json`)

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self' 'unsafe-inline' 'unsafe-eval';
  style-src   'self' 'unsafe-inline';
  img-src     'self' data: https:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.rawg.io https://media.rawg.io;
  font-src    'self' data:;
  frame-ancestors 'none';
  base-uri    'self';
X-Frame-Options:       DENY
X-Content-Type-Options: nosniff
Referrer-Policy:        strict-origin-when-cross-origin
Permissions-Policy:     camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

> `'unsafe-eval'` es requerido por Angular dev (devuelve a quitarse cuando se sirva solo el bundle prod si se compila con AOT estricto).

## 6. Dependencias

- Lockfile (`package-lock.json`) versionado.
- Recomendado en CI: `npm audit --omit=dev --audit-level=high` antes del build.
- Capacitor plugins se mantienen alineados a la versión `^7`.

## 7. Datos personales (RGPD)

- Solo se persisten: email (auth), nombre público, biografía, avatar.
- El usuario puede borrar su cuenta desde Supabase (acción manual del admin si no hay UI).
- Sin tracking de terceros, sin cookies de marketing.

## 8. Buenas prácticas adicionales

- `formAction` HTTPS only.
- Sanitización implícita de Angular (`{{ … }}`); evitar `innerHTML` con contenido de usuario.
- Validación en cliente + RLS en servidor (defensa en profundidad).
- WebSockets sobre `wss://` (forzado por `connect-src`).
