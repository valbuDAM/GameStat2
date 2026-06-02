# GAMESTAT

![CI](https://github.com/benat/GameStatTFG/actions/workflows/ci.yml/badge.svg)
![Web Deploy](https://github.com/benat/GameStatTFG/actions/workflows/deploy-web.yml/badge.svg)
![Android Build](https://github.com/benat/GameStatTFG/actions/workflows/build-android.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue)

> Red social ligera para reseñar y comentar videojuegos. **Ionic 8 + Angular 17 + Supabase + Capacitor 7**.

---

## ✨ Funcionalidades

- 🔐 Auth con email + contraseña (Supabase Auth, JWT).
- 📰 Feed social con likes optimistas, comentarios y scroll infinito.
- ⭐ Reseñas 1-10 con distribución estadística y media por juego.
- 💬 Chat 1-a-1 y de grupo con realtime, indicador "escribiendo…" y gestión de admins.
- 👥 Seguidores / siguiendo con búsqueda fuzzy de perfiles.
- 📴 Modo offline con cola persistente y reintentos.
- 📱 PWA web + APK Android (Capacitor).
- 🎨 Animaciones Ionic nativas, haptics y share nativo.

## 🚀 Getting started

### Requisitos

- Node.js 20+
- Cuenta gratuita en [Supabase](https://supabase.com) y [RAWG](https://rawg.io/apidocs)
- (Opcional Android) JDK 17 + Android Studio

### 1. Clonar e instalar

```bash
git clone https://github.com/benat/GameStatTFG.git
cd GameStatTFG
npm install
```

### 2. Configurar secretos locales

Crea `src/environments/environment.local.ts` a partir del ejemplo:

```bash
cp src/environments/environment.local.example.ts src/environments/environment.local.ts
```

Rellénalo con tus credenciales:

```ts
export const localSecrets = {
  supabaseUrl: 'https://xxxxx.supabase.co',
  supabaseAnonKey: 'eyJ...',
  rawgApiKey: 'xxxxxxxx'
};
```

> Este fichero está en `.gitignore` y nunca se sube. Ver también `.env.example` para CI/CD.

### 3. Crear la base de datos

Ejecuta en orden los scripts de `supabase/` en el SQL Editor de Supabase (ver `supabase/README.md`).

### 4. Arrancar en local

```bash
npm start          # http://localhost:4200
npm run build      # bundle prod a www/
npm test           # tests Karma + Jasmine
```

### 5. Android

```bash
npm run apk:debug    # APK debug (Windows)
npm run apk:release  # APK release firmado (requiere keystore)
```

---

## 🧱 Stack

| Capa | Tecnología |
| --- | --- |
| UI | Ionic 8 (standalone components), Angular 17 + Signals |
| Estado | Angular Signals + RxJS puntual |
| Backend | Supabase (Postgres 15 + Auth + Realtime) |
| Móvil | Capacitor 7 + plugins (network, preferences, status-bar, keyboard, haptics, share, app) |
| Build | Angular CLI, esbuild |
| Test | Karma + Jasmine, Chrome Headless |
| CI/CD | GitHub Actions → Vercel (web) + APK artifact (Android) |

---

## 📂 Estructura

```
src/app/
  core/     servicios + guardas + modelos
  shared/   componentes/pipes reutilizables (UserAvatar, RatingStars, EmptyState, ReviewStatsCard, TimeAgo)
  pages/    rutas (standalone)
supabase/   esquema + RLS + RPCs
docs/       documentación TFG
android/    proyecto Capacitor / Gradle
```

---

## 📚 Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — diagramas C4 + decisiones técnicas
- [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) — modelo ER, tablas, RLS y RPCs
- [`docs/SECURITY.md`](docs/SECURITY.md) — threat model, RLS, CSP, JWT
- [`docs/SCHEDULE.md`](docs/SCHEDULE.md) — Gantt + horas
- [`docs/BUDGET.md`](docs/BUDGET.md) — presupuesto y costes recurrentes
- [`docs/PLATFORMS.md`](docs/PLATFORMS.md) — diferencias Web vs Android
- [`docs/USER-MANUAL.md`](docs/USER-MANUAL.md) — manual de usuario
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — historial de versiones

---

## 🔒 Seguridad

- Todas las tablas con **RLS activa**.
- Operaciones cross-user mediante **RPCs `SECURITY DEFINER`** auditadas.
- CSP estricta + HSTS + `X-Frame-Options: DENY` en `vercel.json`.
- Secretos solo en `environment.local.ts` (gitignored) o GitHub Secrets.

---

## 🧪 Tests

```bash
npm test -- --watch=false --browsers=ChromeHeadlessNoSandbox --code-coverage
```

Cobertura HTML en `coverage/index.html`.

---

## 📝 Licencia

MIT
