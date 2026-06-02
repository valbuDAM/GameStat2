import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonAvatar,
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  arrowUpCircleOutline,
  closeOutline,
  createOutline,
  ellipsisVertical,
  exitOutline,
  personRemoveOutline,
  sendOutline
} from 'ionicons/icons';

import { ChatMessage, Conversation, UserProfile } from '../../models';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { ProfileService } from '../../core/services/profile.service';
import { PlatformService } from '../../core/services/platform.service';
import { TimeAgoPipe } from '../../shared';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonAvatar,
    IonBackButton,
    IonButton,
    IonButtons,
    IonChip,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
    TimeAgoPipe
  ],
  styleUrls: ['./chat-detail.page.scss'],
  template: `
    <ion-header>
      <ion-toolbar color="dark">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/social"></ion-back-button>
        </ion-buttons>
        <ion-title>
          <div class="title-row" *ngIf="conversation() as conv">
            <ion-avatar class="avatar-circle">
              <span>{{ conv.avatar }}</span>
            </ion-avatar>
            <div class="title-text">
              <strong>{{ conv.title }}</strong>
              <small>
                {{ conv.type === 'group' ? (conv.memberCount || conv.participants.length) + ' miembros' : 'Chat privado' }}
              </small>
            </div>
          </div>
        </ion-title>
        <ion-buttons slot="end" *ngIf="conversation()?.type === 'group'">
          <ion-button (click)="openGroupOptions()">
            <ion-icon slot="icon-only" name="ellipsis-vertical"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content [scrollEvents]="true" (ionScroll)="onScroll($event)">
      <div class="chat-shell" #scrollContainer aria-live="polite">
        <ion-text color="danger" *ngIf="errorMessage()">
          <p class="error">{{ errorMessage() }}</p>
        </ion-text>

        <div class="loading" *ngIf="loading()">
          <ion-spinner name="crescent"></ion-spinner>
        </div>

        <div class="loading older" *ngIf="loadingOlder()">
          <ion-spinner name="dots"></ion-spinner>
        </div>

        <div
          *ngFor="let msg of messages(); trackBy: trackById"
          class="message"
          [class.own]="msg.senderId === currentUserId()">
          <ion-avatar class="avatar-circle small">
            <span>{{ msg.senderAvatar }}</span>
          </ion-avatar>
          <div class="bubble">
            <header>
              <strong [routerLink]="['/profile', msg.senderId]" class="sender-name">
                {{ msg.senderName }}
              </strong>
              <span>
                {{ msg.createdAt }}
                <em *ngIf="msg.editedAt" class="edited">(editado)</em>
              </span>
            </header>
            <p>{{ msg.content }}</p>
            <button
              *ngIf="msg.senderId === currentUserId()"
              type="button"
              class="edit-btn"
              (click)="promptEditMessage(msg)"
              aria-label="Editar mensaje">
              <ion-icon name="create-outline"></ion-icon>
            </button>
          </div>
        </div>

        <p class="empty" *ngIf="!loading() && messages().length === 0">
          Aun no hay mensajes. Empieza la conversacion!
        </p>

        <p class="typing" *ngIf="typingLabel() as label" aria-live="polite">
          {{ label }}
        </p>
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar color="dark">
        <div class="composer">
          <ion-textarea
            [(ngModel)]="draft"
            placeholder="Escribe un mensaje..."
            (keydown)="onComposerKey($event)"
            (ionInput)="onComposerInput()"
            [disabled]="sending()"
            autoGrow="true"
            rows="1"
            [maxlength]="4000">
          </ion-textarea>
          <ion-button
            (click)="send()"
            [disabled]="sending() || !draft.trim()"
            shape="round">
            <ion-icon slot="icon-only" name="send-outline"></ion-icon>
          </ion-button>
        </div>
      </ion-toolbar>
    </ion-footer>

    <!-- Modal de gestión de grupo -->
    <div
      class="group-modal-backdrop"
      *ngIf="groupModalOpen()"
      (click)="closeGroupModal()">
      <section
        class="surface-card group-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Gestión del grupo"
        (click)="$event.stopPropagation()">
        <header class="group-modal-header">
          <div>
            <p class="eyebrow">Grupo</p>
            <h2>{{ conversation()?.title }}</h2>
          </div>
          <ion-button fill="clear" color="medium" (click)="closeGroupModal()">
            <ion-icon slot="icon-only" name="close-outline"></ion-icon>
          </ion-button>
        </header>

        <p class="members-title">Miembros ({{ conversation()?.participants?.length || 0 }})</p>

        <ion-list lines="none" class="members-list">
          <ion-item *ngFor="let p of conversation()?.participants || []">
            <ion-avatar slot="start" class="avatar-circle small">
              <span>{{ p.avatar }}</span>
            </ion-avatar>
            <ion-label>
              <h3>
                {{ p.name }}
                <span *ngIf="p.userId === currentUserId()" class="me-tag">(tú)</span>
              </h3>
              <ion-chip
                [color]="p.role === 'admin' ? 'warning' : 'medium'"
                class="role-chip">
                {{ p.role === 'admin' ? 'Admin' : 'Miembro' }}
              </ion-chip>
            </ion-label>

            <ion-buttons slot="end">
              <ion-button
                *ngIf="canPromote(p)"
                fill="clear"
                color="warning"
                size="small"
                aria-label="Promover a admin"
                (click)="promoteMember(p.userId, p.name)">
                <ion-icon slot="icon-only" name="arrow-up-circle-outline"></ion-icon>
              </ion-button>
              <ion-button
                *ngIf="canRemove(p)"
                fill="clear"
                color="danger"
                size="small"
                aria-label="Eliminar del grupo"
                (click)="removeMember(p.userId, p.name)">
                <ion-icon slot="icon-only" name="person-remove-outline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-item>
        </ion-list>

        <!-- Buscador de nuevos miembros (solo admin) -->
        <div *ngIf="isAdmin()" class="add-member-section">
          <p class="members-title">Añadir miembro</p>
          <ion-item lines="none">
            <ion-label position="stacked">Buscar usuario</ion-label>
            <ion-input
              [(ngModel)]="addMemberQuery"
              (ionInput)="onAddMemberSearch()"
              placeholder="Nombre del usuario"
              autocapitalize="off"
              autocorrect="off">
            </ion-input>
          </ion-item>

          <div class="loading" *ngIf="addMemberLoading()">
            <ion-spinner name="dots"></ion-spinner>
          </div>

          <ion-list lines="none" *ngIf="addMemberResults().length > 0" class="search-results">
            <ion-item
              button
              *ngFor="let u of addMemberResults(); trackBy: trackByUser"
              (click)="addMember(u)">
              <ion-avatar slot="start" class="avatar-circle small">
                <span>{{ initials(u.name) }}</span>
              </ion-avatar>
              <ion-label>{{ u.name }}</ion-label>
              <ion-icon slot="end" name="add-circle-outline" color="primary"></ion-icon>
            </ion-item>
          </ion-list>

          <ion-text
            color="medium"
            *ngIf="!addMemberLoading() && addMemberQuery.trim().length >= 2 && addMemberResults().length === 0">
            <p class="empty">Sin resultados.</p>
          </ion-text>
        </div>

        <div class="group-modal-actions">
          <ion-button fill="outline" color="danger" (click)="leaveGroup()">
            <ion-icon slot="start" name="exit-outline"></ion-icon>
            Abandonar grupo
          </ion-button>
          <ion-button fill="solid" color="medium" (click)="closeGroupModal()">
            Cerrar
          </ion-button>
        </div>
      </section>
    </div>
  `
})
export class ChatDetailPage implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

  readonly conversationId = signal('');
  readonly loading = signal(false);
  readonly loadingOlder = signal(false);
  readonly sending = signal(false);
  readonly errorMessage = signal('');
  draft = '';

  readonly messages = computed<ChatMessage[]>(() =>
    this.chat.messagesFor(this.conversationId())
  );
  readonly conversation = computed<Conversation | undefined>(() =>
    this.chat.getConversation(this.conversationId())
  );
  readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? '');

  /** Texto del indicador de "X está escribiendo…" (o vacío si nadie escribe). */
  readonly typingLabel = computed(() => {
    const names = Object.values(this.chat.typingUsers());
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} está escribiendo…`;
    if (names.length === 2) return `${names[0]} y ${names[1]} están escribiendo…`;
    return 'Varios usuarios están escribiendo…';
  });

  private unsubscribe?: () => void;
  private prevMessageCount = 0;
  private suppressAutoScrollOnce = false;
  /** Si el usuario está cerca del final cuando llega un mensaje, hacemos auto-scroll. */
  private nearBottom = true;
  private readonly NEAR_BOTTOM_PX = 120;

  // -------- Modal gestión de grupo --------
  readonly groupModalOpen = signal(false);
  readonly addMemberResults = signal<UserProfile[]>([]);
  readonly addMemberLoading = signal(false);
  addMemberQuery = '';
  private addMemberSearchHandle: ReturnType<typeof setTimeout> | null = null;

  /** ¿El usuario actual es admin del grupo? */
  readonly isAdmin = computed(() => {
    const conv = this.conversation();
    const myId = this.currentUserId();
    if (!conv || !myId) return false;
    return conv.participants.some((p) => p.userId === myId && p.role === 'admin');
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly chat: ChatService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
    private readonly profiles: ProfileService,
    private readonly platform: PlatformService
  ) {
    addIcons({
      sendOutline,
      ellipsisVertical,
      createOutline,
      addCircleOutline,
      arrowUpCircleOutline,
      closeOutline,
      exitOutline,
      personRemoveOutline
    });
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('conversationId') ?? '';
    if (!id) {
      this.errorMessage.set('Conversacion invalida.');
      return;
    }
    this.conversationId.set(id);
    this.chat.setActiveConversation(id);

    if (!this.chat.getConversation(id)) {
      await this.chat.loadConversations().catch(() => undefined);
    }

    this.loading.set(true);
    try {
      await Promise.all([
        this.chat.loadParticipants(id).catch(() => undefined),
        this.chat.loadMessages(id)
      ]);
      await this.chat.markConversationRead(id);
    } catch (e) {
      this.errorMessage.set(e instanceof Error ? e.message : 'No se pudo cargar el chat.');
    } finally {
      this.loading.set(false);
    }

    this.unsubscribe = this.chat.subscribeToConversation(id);
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
    this.chat.setActiveConversation(null);
  }

  ngAfterViewChecked(): void {
    const count = this.messages().length;
    if (count !== this.prevMessageCount) {
      const prev = this.prevMessageCount;
      this.prevMessageCount = count;

      // Mensajes anteriores (paginación scroll-up): nunca auto-scroll.
      if (this.suppressAutoScrollOnce) {
        this.suppressAutoScrollOnce = false;
        return;
      }

      // Auto-scroll solo si era el primer load o el usuario estaba al final.
      const isFirstLoad = prev === 0;
      if (isFirstLoad || this.nearBottom) {
        requestAnimationFrame(() => this.scrollToBottom());
      }
    }
  }

  trackById(_: number, m: ChatMessage): string {
    return m.id;
  }

  async send(): Promise<void> {
    const content = this.draft.trim();
    if (!content) return;
    this.sending.set(true);
    try {
      await this.chat.sendMessage(this.conversationId(), content);
      this.draft = '';
      this.chat.stopTyping();
      void this.platform.send();
      // Tras enviar, el usuario debería ver su propio mensaje al final.
      this.nearBottom = true;
    } catch (e) {
      void this.showToast(e instanceof Error ? e.message : 'Error', 'danger');
    } finally {
      this.sending.set(false);
    }
  }

  /**
   * Atajos del composer:
   *   Enter         → enviar
   *   Shift+Enter   → salto de línea (comportamiento por defecto del textarea)
   */
  onComposerKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }

  onComposerInput(): void {
    this.chat.notifyTyping();
  }

  /** Scroll en la parte superior: cargar mensajes anteriores. */
  async onScroll(ev: CustomEvent<{ scrollTop: number }>): Promise<void> {
    const top = ev.detail?.scrollTop ?? 0;

    // Actualizar "nearBottom" mirando contenedor.
    const el = this.scrollContainer?.nativeElement;
    if (el) {
      const distanceToBottom = el.scrollHeight - el.clientHeight - top;
      this.nearBottom = distanceToBottom < this.NEAR_BOTTOM_PX;
    }

    if (this.loadingOlder() || this.loading()) return;
    if (top > 80) return;
    if (!this.chat.hasMoreMessages(this.conversationId())) return;

    this.loadingOlder.set(true);
    this.suppressAutoScrollOnce = true;
    try {
      await this.chat.loadOlderMessages(this.conversationId());
    } catch (e) {
      void this.showToast(e instanceof Error ? e.message : 'Error', 'danger');
    } finally {
      this.loadingOlder.set(false);
    }
  }

  async promptEditMessage(msg: ChatMessage): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Editar mensaje',
      inputs: [
        {
          name: 'content',
          type: 'textarea',
          value: msg.content,
          attributes: { maxlength: 4000 }
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data: { content: string }) => {
            const next = (data.content ?? '').trim();
            if (!next || next === msg.content) return true;
            try {
              await this.chat.editMessage(msg.id, msg.conversationId, next);
              void this.showToast('Mensaje editado');
            } catch (e) {
              void this.showToast(e instanceof Error ? e.message : 'Error', 'danger');
            }
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async openGroupOptions(): Promise<void> {
    const conv = this.conversation();
    if (!conv) return;
    // Asegurar lista de participantes actualizada.
    await this.chat.loadParticipants(conv.id).catch(() => undefined);
    this.addMemberQuery = '';
    this.addMemberResults.set([]);
    this.groupModalOpen.set(true);
  }

  closeGroupModal(): void {
    this.groupModalOpen.set(false);
    if (this.addMemberSearchHandle) {
      clearTimeout(this.addMemberSearchHandle);
      this.addMemberSearchHandle = null;
    }
  }

  trackByUser(_: number, u: UserProfile): string {
    return u.id;
  }

  initials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((it) => it[0]?.toUpperCase() ?? '')
      .join('');
  }

  /** ¿Puedo promover a este miembro? Solo admin, y solo si target no es admin ni soy yo. */
  canPromote(p: { userId: string; role: string }): boolean {
    return this.isAdmin() && p.role !== 'admin' && p.userId !== this.currentUserId();
  }

  /** ¿Puedo eliminar a este miembro? Solo admin, y solo si no soy yo. */
  canRemove(p: { userId: string }): boolean {
    return this.isAdmin() && p.userId !== this.currentUserId();
  }

  async promoteMember(userId: string, name: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Promover a admin',
      message: `¿Promover a ${name} como administrador del grupo?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Promover',
          handler: async () => {
            try {
              await this.chat.promoteGroupMember(this.conversationId(), userId);
              void this.showToast(`${name} ahora es admin.`);
            } catch (e) {
              void this.showToast(e instanceof Error ? e.message : 'Error', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async removeMember(userId: string, name: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar miembro',
      message: `¿Eliminar a ${name} del grupo?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.chat.removeGroupMember(this.conversationId(), userId);
              void this.showToast(`${name} eliminado del grupo.`);
            } catch (e) {
              void this.showToast(e instanceof Error ? e.message : 'Error', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async leaveGroup(): Promise<void> {
    const me = this.auth.currentUser();
    const convId = this.conversationId();
    if (!me || !convId) return;
    const alert = await this.alertCtrl.create({
      header: 'Abandonar grupo',
      message: '¿Seguro que quieres abandonar este grupo?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Abandonar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.chat.removeGroupMember(convId, me.id);
              this.groupModalOpen.set(false);
              await this.router.navigateByUrl('/tabs/social');
            } catch (e) {
              void this.showToast(e instanceof Error ? e.message : 'Error', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /** Debounced autocompletion vía search_profiles. */
  onAddMemberSearch(): void {
    if (this.addMemberSearchHandle) clearTimeout(this.addMemberSearchHandle);
    const q = this.addMemberQuery.trim();
    if (q.length < 2) {
      this.addMemberResults.set([]);
      this.addMemberLoading.set(false);
      return;
    }
    this.addMemberLoading.set(true);
    this.addMemberSearchHandle = setTimeout(async () => {
      try {
        const conv = this.conversation();
        const memberIds = new Set((conv?.participants ?? []).map((p) => p.userId));
        const results = await this.profiles.search(q, 10);
        this.addMemberResults.set(results.filter((u) => !memberIds.has(u.id)));
      } catch {
        this.addMemberResults.set([]);
      } finally {
        this.addMemberLoading.set(false);
      }
    }, 250);
  }

  async addMember(user: UserProfile): Promise<void> {
    try {
      await this.chat.addGroupMember(this.conversationId(), user.id);
      this.addMemberQuery = '';
      this.addMemberResults.set([]);
      void this.showToast(`${user.name} añadido al grupo.`);
    } catch (e) {
      void this.showToast(e instanceof Error ? e.message : 'Error', 'danger');
    }
  }

  private scrollToBottom(): void {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' = 'success'
  ): Promise<void> {
    const t = await this.toastCtrl.create({
      message,
      duration: 2200,
      color,
      position: 'top'
    });
    await t.present();
  }
}
