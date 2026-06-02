import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonBadge,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubblesOutline,
  gameControllerOutline,
  homeOutline,
  newspaperOutline,
  peopleOutline,
  starOutline
} from 'ionicons/icons';

import { AppHeaderComponent } from '../../core/components/app-header/app-header.component';
import { ChatService } from '../../core/services/chat.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    AppHeaderComponent,
    IonBadge,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    IonTabBar,
    IonTabButton,
    IonTabs
  ],
  styleUrls: ['./tabs.page.scss'],
  template: `
    <app-header></app-header>

    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>

      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="home" href="/tabs/home">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Home</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="feed" href="/tabs/feed">
          <ion-icon name="newspaper-outline"></ion-icon>
          <ion-label>Feed</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="review" href="/tabs/review">
          <ion-icon name="star-outline"></ion-icon>
          <ion-label>Review</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="games" href="/tabs/games">
          <ion-icon name="game-controller-outline"></ion-icon>
          <ion-label>Juegos</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="social" href="/tabs/social">
          <ion-icon name="chatbubbles-outline"></ion-icon>
          <ion-label>Social</ion-label>
          <ion-badge *ngIf="chat.totalUnread() > 0" color="danger">
            {{ chat.totalUnread() }}
          </ion-badge>
        </ion-tab-button>
        <ion-tab-button tab="users" href="/tabs/users">
          <ion-icon name="people-outline"></ion-icon>
          <ion-label>Users</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `
})
export class TabsPage {
  constructor(public readonly chat: ChatService) {
    addIcons({
      homeOutline,
      starOutline,
      gameControllerOutline,
      chatbubblesOutline,
      newspaperOutline,
      peopleOutline
    });
  }
}
