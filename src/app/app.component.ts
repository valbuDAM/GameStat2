import { Component, NgZone, OnInit, inject } from '@angular/core';
import { Location } from '@angular/common';
import { IonApp, IonRouterOutlet, NavController } from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

import { OfflineBannerComponent } from './shared/components/offline-banner/offline-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet, OfflineBannerComponent],
  template: `
    <ion-app>
      <app-offline-banner></app-offline-banner>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `
})
export class AppComponent implements OnInit {
  private readonly zone = inject(NgZone);
  private readonly location = inject(Location);
  private readonly navCtrl = inject(NavController);

  async ngOnInit(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    // StatusBar coherente con el tema.
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#1b182e' });
    } catch {
      /* StatusBar plugin may be unavailable */
    }

    // Ajuste de viewport al abrir el teclado.
    try {
      await Keyboard.setAccessoryBarVisible({ isVisible: false });
    } catch {
      /* Keyboard plugin may be unavailable */
    }

    // Hardware back button → cerrar modales / volver.
    CapacitorApp.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
      this.zone.run(() => {
        // Cerrar overlay abierto (modal/alert/action-sheet) si existe.
        const overlay = document.querySelector(
          'ion-modal.show-modal, ion-alert.show-alert, ion-action-sheet.show-action-sheet, .group-modal-backdrop, .group-modal-backdrop *'
        );
        if (overlay) {
          (overlay as HTMLElement).click();
          return;
        }
        if (canGoBack) {
          this.location.back();
        } else {
          void CapacitorApp.exitApp();
        }
      });
    });
  }
}
