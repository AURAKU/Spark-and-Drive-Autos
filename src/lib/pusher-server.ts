import Pusher from "pusher";

import { CHAT_PUSHER_EVENT, chatThreadChannelName, type ChatPusherMessagePayload } from "@/lib/chat-realtime";

let server: Pusher | null = null;

export function getPusherServer(): Pusher | null {
  const id = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;
  if (!id || !key || !secret || !cluster) return null;
  if (!server) {
    server = new Pusher({ appId: id, key, secret, cluster, useTLS: true });
  }
  return server;
}

/** Push a thread event to subscribers of `private-chat-{threadId}`. No-op if Pusher env is missing. */
export async function pushChatThreadMessage(threadId: string, data: ChatPusherMessagePayload) {
  const p = getPusherServer();
  if (!p) return;
  try {
    await p.trigger(chatThreadChannelName(threadId), CHAT_PUSHER_EVENT, data);
  } catch (e) {
    console.error("[pusher] pushChatThreadMessage", e);
  }
}
