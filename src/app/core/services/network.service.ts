import { Injectable, NgZone, signal } from '@angular/core';
import { Network } from '@capacitor/network';
import type { NetworkStatus } from '@capacitor/network';

/**
 * Estado de conectividad reactivo basado en `@capacitor/network`.
 *
 * En entornos web (sin runtime nativo) el plugin de Capacitor usa
 * `navigator.onLine`. Aun así reforzamos con los eventos del
 * `window` para máxima cobertura.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  readonly online = signal<boolean>(true);

  constructor(private readonly zone: NgZone) {
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      const status = await Network.getStatus();
      this.setOnline(status.connected);
    } catch {
      this.setOnline(navigator.onLine);
    }

    try {
      await Network.addListener('networkStatusChange', (status: NetworkStatus) => {
        this.zone.run(() => this.setOnline(status.connected));
      });
    } catch {
      // Capacitor no disponible: fallback al navegador
      window.addEventListener('online', () => this.zone.run(() => this.setOnline(true)));
      window.addEventListener('offline', () => this.zone.run(() => this.setOnline(false)));
    }
  }

  private setOnline(value: boolean): void {
    if (this.online() !== value) this.online.set(value);
  }
}
