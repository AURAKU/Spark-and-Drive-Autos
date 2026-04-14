"use client";

import { useEffect, useRef, useState } from "react";

import { CHAT_PUSHER_EVENT, chatThreadChannelName } from "@/lib/chat-realtime";
import { getSharedPusher } from "@/lib/pusher-browser";

export type ChatRealtimeTransport = "pusher" | "polling";

/**
 * Near-real-time updates for a chat thread: Pusher private channel + HTTP polling fallback.
 * - When Pusher connects: infrequent polling as safety net (tab hidden → slower).
 * - When Pusher unavailable: faster polling.
 */
export function useChatThreadRealtime(threadId: string | null, onInvalidate: () => void) {
  const [transport, setTransport] = useState<ChatRealtimeTransport>("polling");
  const onInvalidateRef = useRef(onInvalidate);
  onInvalidateRef.current = onInvalidate;

  useEffect(() => {
    setTransport("polling");
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        const cfgRes = await fetch("/api/chat/pusher-config");
        if (!cfgRes.ok || cancelled) return;
        const cfg = (await cfgRes.json()) as {
          enabled?: boolean;
          key?: string;
          cluster?: string;
          authEndpoint?: string;
        };
        if (!cfg.enabled || !cfg.key || !cfg.cluster || !cfg.authEndpoint || cancelled) return;

        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const authEndpoint = cfg.authEndpoint.startsWith("http")
          ? cfg.authEndpoint
          : `${origin}${cfg.authEndpoint.startsWith("/") ? "" : "/"}${cfg.authEndpoint}`;

        const pusher = getSharedPusher({
          key: cfg.key,
          cluster: cfg.cluster,
          authEndpoint,
        });
        if (cancelled) return;

        const channelName = chatThreadChannelName(threadId);
        const channel = pusher.subscribe(channelName);
        const handler = () => onInvalidateRef.current();
        const onSubError = () => setTransport("polling");
        channel.bind(CHAT_PUSHER_EVENT, handler);
        channel.bind("pusher:subscription_error", onSubError);
        setTransport("pusher");

        unsubscribe = () => {
          try {
            channel.unbind(CHAT_PUSHER_EVENT, handler);
            channel.unbind("pusher:subscription_error", onSubError);
            pusher.unsubscribe(channelName);
          } catch {
            /* ignore */
          }
        };
      } catch {
        setTransport("polling");
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;

    const intervalMs = () => {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const ws = transport === "pusher";
      if (ws) return hidden ? 120_000 : 60_000;
      return hidden ? 45_000 : 5_000;
    };

    const tick = () => onInvalidateRef.current();
    let id = setInterval(tick, intervalMs());
    const onVis = () => {
      clearInterval(id);
      id = setInterval(tick, intervalMs());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [threadId, transport]);

  return { transport };
}
