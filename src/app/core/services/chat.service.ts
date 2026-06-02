import { Injectable, computed, effect, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';

import { ChatMessage, Conversation, ConversationParticipant } from '../../models';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { OfflineQueueService, OutboxAction } from './offline-queue.service';
import { SupabaseService } from './supabase.service';

// ---------- Filas RPC ----------
interface UserConversationRow {
  id: string;
  type: 'private' | 'group';
  title: string | null;
  avatar: string | null;
  last_message_at: string;
  last_message_content: string | null;
  last_message_sender: string | null;
  unread_count: number;
  member_count: number;
  other_user_id: string | null;
  other_user_name: string | null;
  other_user_avatar: string | null;
}

interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string;
  created_at: string;
  edited_at: string | null;
  sender_name: string | null;
  sender_avatar: string | null;
}

type ProfileJoin = { name: string | null; avatar: string | null };

interface ParticipantRow {
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  profiles?: ProfileJoin | ProfileJoin[] | null;
}

function firstProfile(p: ProfileJoin | ProfileJoin[] | null | undefined): ProfileJoin | null {
  if (!p) return null;
  return Array.isArray(p) ? (p[0] ?? null) : p;
}

const PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly conversations = signal<Conversation[]>([]);
  readonly loadingConversations = signal(false);
  readonly messagesByConversation = signal<Record<string, ChatMessage[]>>({});
  readonly hasMoreByConversation = signal<Record<string, boolean>>({});
  /** userId → name de los usuarios que están escribiendo en la conversación activa. */
  readonly typingUsers = signal<Record<string, string>>({});

  /** Suma de unreadCount de todas las conversaciones (badges globales). */
  readonly totalUnread = computed(() =>
    this.conversations().reduce((acc, c) => acc + (c.unreadCount ?? 0), 0)
  );

  private conversationsChannel: RealtimeChannel | null = null;
  private messagesChannel: RealtimeChannel | null = null;
  private currentRoomChannel: RealtimeChannel | null = null;
  private currentRoomId: string | null = null;
  private activeConversationId: string | null = null;
  private wasOnline = true;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private isCurrentlyTyping = false;
  private initialized = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auth: AuthService,
    private readonly network: NetworkService,
    private readonly offlineQueue: OfflineQueueService
  ) {
    this.offlineQueue.register('send_message', (action) => this.executeSendMessage(action));

    // Reconexión: cuando volvemos online tras una caída, recargar
    // conversaciones y re-suscribir los canales realtime.
    effect(() => {
      const online = this.network.online();
      if (online && !this.wasOnline && this.initialized) {
        void this.loadConversations();
        this.subscribeRealtime();
        if (this.currentRoomId) {
          const id = this.currentRoomId;
          this.subscribeToConversation(id);
        }
      }
      this.wasOnline = online;
    }, { allowSignalWrites: true });

    if (this.supabaseService.isConfigured) {
      void this.bootstrap();
    }
  }

  private async bootstrap(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.auth.waitUntilReady();
    if (!this.auth.currentUser()) return;

    await this.loadConversations().catch((e) => console.error('conversations:', e));
    this.subscribeRealtime();
  }

  // -------------------------------------------------------------------
  // CONVERSATIONS
  // -------------------------------------------------------------------
  async loadConversations(): Promise<void> {
    const client = this.supabaseService.client;
    const me = this.auth.currentUser();
    if (!client || !me) return;

    this.loadingConversations.set(true);
    try {
      const { data, error } = await client.rpc('get_user_conversations');
      if (error) throw new Error(this.mapError(error.message));

      const rows = (data as UserConversationRow[] | null) ?? [];
      const previous = new Map(this.conversations().map((c) => [c.id, c]));
      const mapped: Conversation[] = rows.map((row) =>
        this.mapUserConversationRow(row, previous.get(row.id)?.participants ?? [])
      );
      this.conversations.set(mapped);
    } finally {
      this.loadingConversations.set(false);
    }
  }

  /** Carga la lista de participantes (con nombre/avatar) de una conversación. */
  async loadParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('conversation_participants')
      .select('conversation_id, user_id, role, joined_at, profiles(name, avatar)')
      .eq('conversation_id', conversationId);

    if (error) throw new Error(this.mapError(error.message));

    const participants: ConversationParticipant[] = (
      (data as unknown as ParticipantRow[] | null) ?? []
    ).map((row) => {
      const prof = firstProfile(row.profiles);
      const name = prof?.name ?? 'Usuario';
      return {
        userId: row.user_id,
        name,
        avatar: prof?.avatar || this.initials(name),
        role: row.role
      };
    });

    this.conversations.update((list) =>
      list.map((c) => (c.id === conversationId ? { ...c, participants } : c))
    );

    return participants;
  }

  /** Crea (o devuelve la existente) conversación privada con otherUserId. */
  async getOrCreatePrivateConversation(otherUserId: string): Promise<string> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client.rpc('get_or_create_private_conversation', {
      other_user: otherUserId
    });
    if (error) throw new Error(this.mapError(error.message));
    await this.loadConversations();
    return data as string;
  }

  /** Crea un grupo con un titulo y miembros (sin incluir al usuario actual). */
  async createGroup(title: string, memberIds: string[], avatar = ''): Promise<string> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client.rpc('create_group_conversation', {
      p_title: title,
      p_avatar: avatar,
      member_ids: memberIds
    });
    if (error) throw new Error(this.mapError(error.message));
    await this.loadConversations();
    return data as string;
  }

  async addGroupMember(conversationId: string, userId: string): Promise<void> {
    const client = this.supabaseService.assertConfigured();
    const { error } = await client.rpc('add_group_member', {
      conv_id: conversationId,
      new_user: userId
    });
    if (error) throw new Error(this.mapError(error.message));
    await this.loadConversations();
    await this.loadParticipants(conversationId).catch(() => undefined);
  }

  async removeGroupMember(conversationId: string, userId: string): Promise<void> {
    const client = this.supabaseService.assertConfigured();
    const { error } = await client.rpc('remove_group_member', {
      conv_id: conversationId,
      target_user: userId
    });
    if (error) throw new Error(this.mapError(error.message));
    await this.loadConversations();
    await this.loadParticipants(conversationId).catch(() => undefined);
  }

  async promoteGroupMember(conversationId: string, userId: string): Promise<void> {
    const client = this.supabaseService.assertConfigured();
    const { error } = await client.rpc('promote_group_member', {
      conv_id: conversationId,
      target_user: userId
    });
    if (error) throw new Error(this.mapError(error.message));
    await this.loadParticipants(conversationId).catch(() => undefined);
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations().find((c) => c.id === id);
  }

  // -------------------------------------------------------------------
  // MESSAGES
  // -------------------------------------------------------------------
  /** Carga la primera página de mensajes (los más recientes) y reemplaza la caché. */
  async loadMessages(conversationId: string): Promise<void> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client.rpc('get_conversation_messages', {
      conv_id: conversationId,
      before_ts: null,
      page_limit: PAGE_SIZE
    });

    if (error) throw new Error(this.mapError(error.message));

    const rows = (data as ConversationMessageRow[] | null) ?? [];
    // RPC devuelve DESC; el UI muestra ASC (más antiguo arriba).
    const mapped = rows.map((r) => this.mapMessageRow(r)).reverse();

    this.messagesByConversation.update((items) => ({
      ...items,
      [conversationId]: mapped
    }));
    this.hasMoreByConversation.update((items) => ({
      ...items,
      [conversationId]: rows.length === PAGE_SIZE
    }));
  }

  /** Carga la siguiente página hacia atrás (mensajes más antiguos). Devuelve cuántos cargó. */
  async loadOlderMessages(conversationId: string): Promise<number> {
    const cached = this.messagesByConversation()[conversationId] ?? [];
    if (cached.length === 0) {
      await this.loadMessages(conversationId);
      return this.messagesByConversation()[conversationId]?.length ?? 0;
    }
    if (this.hasMoreByConversation()[conversationId] === false) return 0;

    const client = this.supabaseService.assertConfigured();
    const oldest = cached[0];
    const beforeIso = new Date(oldest.createdAtTimestamp).toISOString();

    const { data, error } = await client.rpc('get_conversation_messages', {
      conv_id: conversationId,
      before_ts: beforeIso,
      page_limit: PAGE_SIZE
    });
    if (error) throw new Error(this.mapError(error.message));

    const rows = (data as ConversationMessageRow[] | null) ?? [];
    const olderAsc = rows.map((r) => this.mapMessageRow(r)).reverse();

    this.messagesByConversation.update((items) => ({
      ...items,
      [conversationId]: [...olderAsc, ...(items[conversationId] ?? [])]
    }));
    this.hasMoreByConversation.update((items) => ({
      ...items,
      [conversationId]: rows.length === PAGE_SIZE
    }));

    return olderAsc.length;
  }

  hasMoreMessages(conversationId: string): boolean {
    return this.hasMoreByConversation()[conversationId] !== false;
  }

  messagesFor(conversationId: string): ChatMessage[] {
    return this.messagesByConversation()[conversationId] ?? [];
  }

  async sendMessage(conversationId: string, content: string): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) throw new Error('No hay sesion activa.');
    const clean = content.trim();
    if (!clean) return;

    // Offline: encolar y reflejar como mensaje pendiente en UI.
    if (!this.network.online()) {
      const tempId = `pending-${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      this.appendMessage({
        id: tempId,
        conversationId,
        senderId: me.id,
        senderName: me.name,
        senderAvatar: me.avatar || this.initials(me.name),
        content: clean,
        createdAt: this.formatTime(nowIso),
        createdAtTimestamp: Date.now(),
        editedAt: null,
        editedAtTimestamp: null,
        pending: true
      });
      await this.offlineQueue.enqueue({
        id: tempId,
        type: 'send_message',
        payload: { conversationId, content: clean, tempId }
      });
      return;
    }

    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: me.id,
        content: clean
      })
      .select('id, conversation_id, sender_id, content, created_at, edited_at')
      .single<ConversationMessageRow>();

    if (error) throw new Error(this.mapError(error.message));

    const optimistic = this.mapMessageRow({
      ...data,
      sender_name: me.name,
      sender_avatar: me.avatar
    });
    this.appendMessage(optimistic);
  }

  /** Ejecutor del outbox: envía un mensaje encolado y elimina el placeholder local. */
  private async executeSendMessage(action: OutboxAction): Promise<void> {
    const conversationId = action.payload['conversationId'] as string;
    const content = action.payload['content'] as string;
    const tempId = action.payload['tempId'] as string;
    const me = this.auth.currentUser();
    if (!me) throw new Error('No hay sesion activa.');

    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: me.id, content })
      .select('id, conversation_id, sender_id, content, created_at, edited_at')
      .single<ConversationMessageRow>();

    if (error) throw new Error(error.message);

    // Sustituir el placeholder por el mensaje real.
    const real = this.mapMessageRow({
      ...data,
      sender_name: me.name,
      sender_avatar: me.avatar
    });
    this.messagesByConversation.update((items) => {
      const list = items[conversationId] ?? [];
      const without = list.filter((m) => m.id !== tempId && m.id !== real.id);
      return {
        ...items,
        [conversationId]: [...without, real].sort(
          (a, b) => a.createdAtTimestamp - b.createdAtTimestamp
        )
      };
    });
  }

  /** Edita un mensaje propio. Usa la policy UPDATE de messages (sender = auth.uid()). */
  async editMessage(
    messageId: string,
    conversationId: string,
    newContent: string
  ): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) throw new Error('No hay sesion activa.');
    const clean = newContent.trim();
    if (!clean) throw new Error('El mensaje no puede estar vacio.');

    const client = this.supabaseService.assertConfigured();
    const editedAtIso = new Date().toISOString();
    const { error } = await client
      .from('messages')
      .update({ content: clean, edited_at: editedAtIso })
      .eq('id', messageId)
      .eq('sender_id', me.id);

    if (error) throw new Error(this.mapError(error.message));

    this.messagesByConversation.update((items) => {
      const list = items[conversationId];
      if (!list) return items;
      return {
        ...items,
        [conversationId]: list.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: clean,
                editedAt: editedAtIso,
                editedAtTimestamp: Date.parse(editedAtIso)
              }
            : m
        )
      };
    });
  }

  // -------------------------------------------------------------------
  // UNREAD
  // -------------------------------------------------------------------
  /** Marca la conversación como leída y pone su unreadCount a 0 localmente. */
  async markConversationRead(conversationId: string): Promise<void> {
    if (!conversationId) return;
    const client = this.supabaseService.client;
    if (!client) return;

    try {
      const { error } = await client.rpc('mark_conversation_read', { conv_id: conversationId });
      if (error) throw new Error(this.mapError(error.message));
    } catch (e) {
      console.error('[ChatService] mark_conversation_read:', e);
      return;
    }

    this.conversations.update((list) =>
      list.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
  }

  /** Marca la conversación abierta para que los mensajes entrantes auto-actualicen su lectura. */
  setActiveConversation(conversationId: string | null): void {
    this.activeConversationId = conversationId;
  }

  // -------------------------------------------------------------------
  // REALTIME
  // -------------------------------------------------------------------
  private subscribeRealtime(): void {
    const client = this.supabaseService.client;
    if (!client) return;

    this.conversationsChannel?.unsubscribe();
    this.messagesChannel?.unsubscribe();

    this.conversationsChannel = client
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_participants' },
        () => {
          void this.loadConversations();
        }
      )
      .subscribe();

    this.messagesChannel = client
      .channel('messages_global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newRow = payload.new as ConversationMessageRow;
          const conv = this.getConversation(newRow.conversation_id);
          if (!conv) {
            void this.loadConversations();
            return;
          }
          const sender = conv.participants.find((p) => p.userId === newRow.sender_id);
          this.appendMessage(
            this.mapMessageRow({
              ...newRow,
              sender_name: sender?.name ?? null,
              sender_avatar: sender?.avatar ?? null
            })
          );
          void this.loadConversations().then(() => {
            if (this.activeConversationId === newRow.conversation_id) {
              void this.markConversationRead(newRow.conversation_id);
            }
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as ConversationMessageRow;
          this.messagesByConversation.update((items) => {
            const list = items[row.conversation_id];
            if (!list) return items;
            return {
              ...items,
              [row.conversation_id]: list.map((m) =>
                m.id === row.id
                  ? {
                      ...m,
                      content: row.content,
                      editedAt: row.edited_at,
                      editedAtTimestamp: row.edited_at ? Date.parse(row.edited_at) : null
                    }
                  : m
              )
            };
          });
        }
      )
      .subscribe();
  }

  /** Suscripción específica a una conversación abierta (mensajes nuevos + presence). */
  subscribeToConversation(conversationId: string): () => void {
    const client = this.supabaseService.client;
    if (!client) return () => undefined;

    const me = this.auth.currentUser();

    this.currentRoomChannel?.unsubscribe();
    this.currentRoomId = conversationId;
    this.typingUsers.set({});

    const channel = client.channel(`conv_${conversationId}`, {
      config: { presence: { key: me?.id ?? 'anonymous' } }
    });

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const row = payload.new as ConversationMessageRow;
          const conv = this.getConversation(conversationId);
          const sender = conv?.participants.find((p) => p.userId === row.sender_id);
          this.appendMessage(
            this.mapMessageRow({
              ...row,
              sender_name: sender?.name ?? null,
              sender_avatar: sender?.avatar ?? null
            })
          );
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<
          string,
          { user_id: string; name: string; typing: boolean }[]
        >;
        const next: Record<string, string> = {};
        for (const [, metas] of Object.entries(state)) {
          for (const meta of metas) {
            if (meta.typing && meta.user_id !== me?.id) {
              next[meta.user_id] = meta.name;
            }
          }
        }
        this.typingUsers.set(next);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && me) {
          await channel.track({ user_id: me.id, name: me.name, typing: false });
        }
      });

    this.currentRoomChannel = channel;

    return () => {
      this.currentRoomChannel?.unsubscribe();
      this.currentRoomChannel = null;
      this.currentRoomId = null;
      this.typingUsers.set({});
      this.isCurrentlyTyping = false;
      if (this.typingTimer) {
        clearTimeout(this.typingTimer);
        this.typingTimer = null;
      }
    };
  }

  /**
   * Marca al usuario actual como "escribiendo" durante 3s.
   * Se llama en cada keystroke; el estado se desactiva solo al pasar
   * el timeout sin nuevas pulsaciones.
   */
  notifyTyping(): void {
    if (!this.currentRoomChannel) return;
    const me = this.auth.currentUser();
    if (!me) return;

    if (this.typingTimer) clearTimeout(this.typingTimer);

    if (!this.isCurrentlyTyping) {
      this.isCurrentlyTyping = true;
      void this.currentRoomChannel.track({
        user_id: me.id,
        name: me.name,
        typing: true
      });
    }

    this.typingTimer = setTimeout(() => {
      this.isCurrentlyTyping = false;
      this.typingTimer = null;
      void this.currentRoomChannel?.track({
        user_id: me.id,
        name: me.name,
        typing: false
      });
    }, 3000);
  }

  /** Cancela explícitamente el estado "escribiendo" (al enviar mensaje). */
  stopTyping(): void {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
    if (!this.isCurrentlyTyping) return;
    this.isCurrentlyTyping = false;
    const me = this.auth.currentUser();
    if (!me || !this.currentRoomChannel) return;
    void this.currentRoomChannel.track({
      user_id: me.id,
      name: me.name,
      typing: false
    });
  }

  // -------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------
  private appendMessage(msg: ChatMessage): void {
    this.messagesByConversation.update((items) => {
      const existing = items[msg.conversationId] ?? [];
      if (existing.some((m) => m.id === msg.id)) {
        return items;
      }
      return {
        ...items,
        [msg.conversationId]: [...existing, msg].sort(
          (a, b) => a.createdAtTimestamp - b.createdAtTimestamp
        )
      };
    });
  }

  private mapUserConversationRow(
    row: UserConversationRow,
    keepParticipants: ConversationParticipant[]
  ): Conversation {
    let title: string;
    let avatar: string;
    if (row.type === 'private') {
      title = row.other_user_name ?? 'Chat privado';
      avatar = row.other_user_avatar || this.initials(title);
    } else {
      title = row.title || 'Grupo';
      avatar = row.avatar || this.initials(title);
    }

    const lastTs = Date.parse(row.last_message_at);
    return {
      id: row.id,
      type: row.type,
      title,
      avatar,
      createdBy: null,
      createdAt: '',
      lastMessageAt: this.formatDate(row.last_message_at),
      lastMessageAtTimestamp: Number.isFinite(lastTs) ? lastTs : 0,
      lastMessageContent: row.last_message_content,
      lastMessageSender: row.last_message_sender,
      unreadCount: row.unread_count ?? 0,
      memberCount: row.member_count ?? 0,
      otherUserId: row.other_user_id,
      participants: keepParticipants
    };
  }

  private mapMessageRow(row: ConversationMessageRow): ChatMessage {
    const ts = Date.parse(row.created_at);
    const name = row.sender_name ?? 'Usuario';
    const editedTs = row.edited_at ? Date.parse(row.edited_at) : null;
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      senderName: name,
      senderAvatar: row.sender_avatar || this.initials(name),
      content: row.content,
      createdAt: this.formatTime(row.created_at),
      createdAtTimestamp: Number.isFinite(ts) ? ts : Date.now(),
      editedAt: row.edited_at,
      editedAtTimestamp: editedTs && Number.isFinite(editedTs) ? editedTs : null
    };
  }

  private formatDate(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }

  private formatTime(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }

  private initials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((it) => it[0]?.toUpperCase() ?? '')
      .join('');
  }

  private mapError(message: string): string {
    console.error('[ChatService] supabase error:', message);

    const m = (message || '').toLowerCase();

    if (m.includes('does not exist') && m.includes('relation')) {
      return 'Las tablas de chat no existen. Ejecuta supabase/chat.sql y supabase/realtime.sql.';
    }
    if (m.includes('does not exist') && m.includes('function')) {
      return 'Faltan funciones RPC de chat. Ejecuta supabase/chat.sql.';
    }
    if (m.includes('pgrst202') || m.includes('could not find the function')) {
      return 'Faltan funciones RPC de chat. Ejecuta supabase/chat.sql.';
    }
    if (m.includes('row-level security') || m.includes('row level security')) {
      return 'La politica RLS de chat no permite esta operacion. Revisa supabase/chat.sql.';
    }
    if (m.includes('permission denied')) {
      return 'Permisos insuficientes en la BBDD. Revisa los GRANT de supabase/chat.sql.';
    }
    if (m.includes('infinite recursion')) {
      return 'Recursion infinita en politicas RLS. Revisa supabase/chat.sql (debe usar is_conversation_member SECURITY DEFINER).';
    }

    return message;
  }
}
