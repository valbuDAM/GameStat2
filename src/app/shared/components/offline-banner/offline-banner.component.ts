import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';

import { NetworkService } from '../../../core/services/network.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';

/**
 * Banner global que se muestra cuando no hay conexión o cuando hay
 * acciones pendientes en el outbox.
 */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="offline-banner" *ngIf="visible()" role="status" aria-live="polite">
      <ion-icon name="cloud-offline-outline"></ion-icon>
      <span *ngIf="!network.online()">Sin conexión. Las acciones se enviarán al volver online.</span>
      <span *ngIf="network.online() && queue.pending().length > 0">
        Sincronizando {{ queue.pending().length }} acción(es) pendientes…
      </span>
    </div>
  `,
  styles: [`
    .offline-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 14px;
      background: rgba(244, 63, 94, 0.95);
      color: #fff;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    .offline-banner ion-icon {
      font-size: 16px;
    }
  `]
})
export class OfflineBannerComponent {
  readonly network = inject(NetworkService);
  readonly queue = inject(OfflineQueueService);

  readonly visible = computed(
    () => !this.network.online() || this.queue.pending().length > 0
  );

  constructor() {
    addIcons({ cloudOfflineOutline });
  }
}
