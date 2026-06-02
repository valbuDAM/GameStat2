import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonAvatar,
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonText,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chatbubbleEllipsesOutline, personAddOutline, personRemoveOutline, searchOutline } from 'ionicons/icons';

import { UserProfile } from '../../models';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { FollowService } from '../../core/services/follow.service';
import { ProfileService } from '../../core/services/profile.service';
import { EmptyStateComponent } from '../../shared';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    IonAvatar,
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonText
  ],
  styleUrls: ['./users.page.scss'],
  template: `
    <ion-content>
      <div class="page-shell page">
        <section class="surface-card users-header">
          <p class="eyebrow">Comunidad</p>
          <h1>Users</h1>
          <p>Usuarios registrados en GameStat.</p>
          <ion-item lines="none" class="search">
            <ion-icon slot="start" name="search-outline"></ion-icon>
            <ion-input
              placeholder="Buscar por nombre..."
              [(ngModel)]="searchTerm"
              (ionInput)="onSearch()"></ion-input>
          </ion-item>
        </section>

        <section class="surface-card users-list">
          <div class="loading" *ngIf="loading()">
            <ion-spinner name="crescent"></ion-spinner>
          </div>

          <ion-text color="danger" *ngIf="error()">
            <p>{{ error() }}</p>
          </ion-text>

          <app-empty-state
            *ngIf="!loading() && !error() && users().length === 0"
            title="No hay usuarios"
            message="Prueba con otro término de búsqueda.">
          </app-empty-state>

          <ion-list lines="none">
            <ion-item
              *ngFor="let user of users(); trackBy: trackByUserId"
              button
              (click)="openProfile(user)">
              <ion-avatar slot="start" class="avatar-circle">
                <span>{{ user.avatar }}</span>
              </ion-avatar>
              <ion-label>
                <h2>{{ user.name }}</h2>
                <p>{{ user.email }}</p>
                <span>{{ user.favoriteGame || 'Sin juego favorito' }}</span>
              </ion-label>

              <ion-button
                slot="end"
                fill="clear"
                color="primary"
                (click)="openChat($event, user)">
                <ion-icon slot="icon-only" name="chatbubble-ellipses-outline"></ion-icon>
              </ion-button>

              <ion-button
                slot="end"
                size="small"
                [fill]="follows.isFollowing(user.id) ? 'outline' : 'solid'"
                [color]="follows.isFollowing(user.id) ? 'medium' : 'primary'"
                (click)="toggleFollow($event, user)"
                *ngIf="user.id !== myId()">
                <ion-icon
                  slot="start"
                  [name]="follows.isFollowing(user.id) ? 'person-remove-outline' : 'person-add-outline'">
                </ion-icon>
                {{ follows.isFollowing(user.id) ? 'Siguiendo' : 'Seguir' }}
              </ion-button>
            </ion-item>
          </ion-list>
        </section>
      </div>
    </ion-content>
  `
})
export class UsersPage implements OnInit {
  readonly users = signal<UserProfile[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  searchTerm = '';
  private searchHandle: ReturnType<typeof setTimeout> | null = null;

  readonly myId = computed(() => this.auth.currentUser()?.id ?? '');

  constructor(
    private readonly profiles: ProfileService,
    private readonly auth: AuthService,
    public readonly follows: FollowService,
    private readonly chat: ChatService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController
  ) {
    addIcons({ searchOutline, personAddOutline, personRemoveOutline, chatbubbleEllipsesOutline });
  }

  ngOnInit(): void {
    void this.loadUsers();
  }

  trackByUserId(_: number, user: UserProfile): string {
    return user.id;
  }

  onSearch(): void {
    if (this.searchHandle) clearTimeout(this.searchHandle);
    this.searchHandle = setTimeout(() => void this.loadUsers(), 250);
  }

  private async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.users.set(await this.profiles.search(this.searchTerm));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios.');
    } finally {
      this.loading.set(false);
    }
  }

  async openProfile(user: UserProfile): Promise<void> {
    await this.router.navigate(['/profile', user.id]);
  }

  async toggleFollow(event: Event, user: UserProfile): Promise<void> {
    event.stopPropagation();
    try {
      if (this.follows.isFollowing(user.id)) {
        await this.follows.unfollow(user.id);
      } else {
        await this.follows.follow(user.id);
      }
    } catch (e) {
      void this.toast(e instanceof Error ? e.message : 'Error', 'danger');
    }
  }

  async openChat(event: Event, user: UserProfile): Promise<void> {
    event.stopPropagation();
    try {
      const id = await this.chat.getOrCreatePrivateConversation(user.id);
      await this.router.navigate(['/tabs/social/chat', id]);
    } catch (e) {
      void this.toast(e instanceof Error ? e.message : 'Error', 'danger');
    }
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2200, color, position: 'top' });
    await t.present();
  }
}
