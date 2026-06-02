import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';

/**
 * Wrapper de plugins nativos (haptics, share) con fallback seguro
 * en web. Todos los métodos son no-throw y devuelven `Promise<void>`.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  /** Vibración corta para acciones ligeras (like, tap). */
  async tap(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      /* ignore */
    }
  }

  /** Vibración media para acciones de envío (mensaje enviado, post creado). */
  async send(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      /* ignore */
    }
  }

  /** Notificación háptica de éxito. */
  async success(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      /* ignore */
    }
  }

  /** Notificación háptica de error. */
  async error(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      /* ignore */
    }
  }

  /**
   * Compartir contenido. En web usa Web Share API si está disponible
   * y degrada a copy-to-clipboard como último recurso.
   */
  async share(payload: { title: string; text?: string; url?: string }): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
          dialogTitle: payload.title
        });
        return;
      } catch {
        /* fallthrough to web */
      }
    }

    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: payload.title, text: payload.text, url: payload.url });
        return;
      } catch {
        /* ignore */
      }
    }

    if (nav?.clipboard && payload.url) {
      try {
        await nav.clipboard.writeText(payload.url);
      } catch {
        /* ignore */
      }
    }
  }
}
