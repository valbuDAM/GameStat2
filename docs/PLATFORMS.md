# Plataformas — Web vs Android

GAMESTAT comparte el **100 %** del código de UI entre web (PWA) y Android (Capacitor 7). Esta nota documenta las únicas divergencias intencionadas.

## 1. Detección de plataforma

`Capacitor.isNativePlatform()` se usa puntualmente en:

- `AppComponent` — registra listeners `App.backButton`, configura StatusBar y Keyboard solo en nativo.
- `PlatformService` — usa `Haptics`/`Share` nativos si está disponible; en web hace fallback a Web Share API o `navigator.clipboard`.

## 2. Diferencias por plataforma

| Funcionalidad | Web | Android |
| --- | --- | --- |
| Status bar | n/a | Estilo `DARK`, color `#1b182e`. |
| Teclado | comportamiento navegador | `resize: 'native'`, `resizeOnFullScreen: true`. |
| Haptics | sin efecto | feedback Light/Medium/Success/Error. |
| Compartir | Web Share API → portapapeles | menú nativo Share. |
| Botón Atrás | navegación navegador | cierra overlays / `history.back()` / `App.exitApp()` si raíz. |
| Almacenamiento local | `localStorage` | `Preferences` (cifrado a nivel app). |
| Notificaciones push | no implementado | no implementado (roadmap). |

## 3. Splash y assets

- `npx @capacitor/assets generate --android` genera mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi a partir de `assets/icon.png` (1024×1024) y `assets/splash.png` (2732×2732).
- Splash duration: 1500 ms (ver `capacitor.config.ts`).

## 4. Safe area insets

`tabs.page.scss` y `app-header.component.scss` usan `env(safe-area-inset-top/bottom)` para Android 14+ y notch.

## 5. Build

| Plataforma | Comando |
| --- | --- |
| Web (dev) | `npm start` |
| Web (prod) | `npm run build` → `www/` desplegable en Vercel. |
| Android (debug) | `npm run apk:debug` (Windows). |
| Android (release) | `npm run apk:release` (firmar con keystore). |

## 6. Test devices recomendados

- mdpi: Pixel 3a emulator (~160 dpi).
- xxhdpi: Pixel 7 emulator o físico (~480 dpi).
- Probar orientación vertical y horizontal en chat y feed.
