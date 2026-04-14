/**
 * Live Support Chat — realtime contract (Pusher Channels).
 *
 * - **Channel:** `private-chat-{threadId}` — requires `/api/chat/pusher-auth` (see Pusher private channels).
 * - **Event:** `message` — payload from server includes `action` where applicable.
 *
 * Fallback: HTTP polling on `GET /api/chat/messages` when Pusher is disabled or auth/subscribe fails.
 */

/** Pusher event name for thread updates (new message, edit, delete). */
export const CHAT_PUSHER_EVENT = "message" as const;

const PREFIX = "private-chat-";

/** Private channel name for a thread (must match server `trigger` target). */
export function chatThreadChannelName(threadId: string): string {
  return `${PREFIX}${threadId}`;
}

/** Parse thread id from a private-chat-* channel name, or null if malformed. */
export function parseThreadIdFromChannelName(channelName: string): string | null {
  if (!channelName.startsWith(PREFIX)) return null;
  const id = channelName.slice(PREFIX.length).trim();
  if (id.length < 20) return null;
  return id;
}

/** Payload shape for `message` events (clients typically refetch GET /api/chat/messages). */
export type ChatPusherMessagePayload = {
  action?: "create" | "edit" | "delete" | "thread_meta";
  id?: string;
  threadId?: string;
  body?: string;
  createdAt?: Date | string;
  senderType?: string;
};
