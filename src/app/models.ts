// =====================================================================
//  Modelos compartidos del dominio GameStat.
//  Tipos del FRONTEND en camelCase. Las filas Supabase (snake_case)
//  se mapean en cada servicio.
// =====================================================================

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  favoriteGame: string;
  bio: string;
  avatar: string;
}

export interface ReviewItem {
  id: string;
  gameId: number | null;
  game: string;
  title: string;
  rating: number;
  comment: string;
  author: string;
  createdAt: string;
  createdAtTimestamp?: number;
}

// ---------- FEED SOCIAL ----------
export interface SocialPost {
  id: string;
  userId: string;
  author: string;
  authorAvatar: string;
  content: string;
  likes: number;
  comments: number;
  liked: boolean;
  createdAt: string;
  createdAtTimestamp: number;
  /** true mientras el post está encolado en el outbox offline. */
  pending?: boolean;
}

export interface SocialComment {
  id: string;
  postId: string;
  userId: string;
  author: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

// ---------- CHAT ----------
export type ConversationType = 'private' | 'group';

export interface ConversationParticipant {
  userId: string;
  name: string;
  avatar: string;
  role: 'admin' | 'member';
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;          // para privados: nombre del otro usuario
  avatar: string;
  createdBy: string | null;
  createdAt: string;
  lastMessageAt: string;
  lastMessageAtTimestamp: number;
  lastMessageContent: string | null;
  lastMessageSender: string | null;
  unreadCount: number;
  memberCount: number;
  otherUserId: string | null;
  participants: ConversationParticipant[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
  createdAtTimestamp: number;
  editedAt: string | null;
  editedAtTimestamp: number | null;
  /** true mientras el mensaje está encolado en el outbox offline. */
  pending?: boolean;
}

// ---------- FOLLOWS ----------
export interface FollowStats {
  followers: number;
  following: number;
  isFollowing: boolean;
}

export interface ProfileSummary {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  followedAt?: string;
  viewerFollows?: boolean;
}

// ---------- REVIEW STATS ----------
export interface ReviewStats {
  totalCount: number;
  avgRating: number;
  /** distribucion[k-1] = nº de reviews con rating == k (k de 1 a 10) */
  distribution: number[];
}

export interface UserReviewStats {
  totalCount: number;
  avgRating: number;
  lastReviewAt: string | null;
}

// ---------- LEGACY (compat) ----------
// Algunas vistas antiguas pueden seguir importando estos tipos.
export type ChatRoom = Conversation;
