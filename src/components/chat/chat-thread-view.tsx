"use client";

import { AttachmentKind, MessageSenderType } from "@prisma/client";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Image as ImageIcon,
  PencilLine,
  SendHorizontal,
  Trash2,
} from "lucide-react";

import { setUserMessagingBlocked } from "@/actions/chat-moderation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CLOUDINARY_USER_MESSAGE, readPublicCloudinaryCloudName } from "@/lib/cloudinary-config-public";
import { displayAssistantBody, SPARK_ASSISTANT_LABEL, SPARK_CHAT_SUGGESTIONS } from "@/lib/live-support-assistant";
import { isLiveSupportIdleSince } from "@/lib/live-support-idle";
import { isAdminRole, isSupportStaffRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { useChatThreadRealtime } from "@/hooks/use-chat-thread-realtime";

export type ChatMessageDto = {
  id: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  messageType: string;
  senderType: MessageSenderType;
  senderUserId: string | null;
  isRead: boolean;
  attachments: Array<{
    id: string;
    url: string;
    kind: AttachmentKind;
    mimeType: string | null;
    durationSec: number | null;
  }>;
  sender: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role?: string | null;
  } | null;
};

export type ChatThreadDto = {
  id: string;
  subject: string | null;
  status?: string | null;
  adminId?: string | null;
  assistantActive?: boolean;
  lastMessageAt?: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone?: string | null;
  customerId: string | null;
  inquiryId: string | null;
  customer: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    phone?: string | null;
    messagingBlocked?: boolean;
    role?: string | null;
  } | null;
  car: { id: string; title: string; slug: string } | null;
  inquiry: { id: string; type: string; status: string; guestPhone?: string | null } | null;
  lead?: { id: string; title: string | null; stage: string } | null;
  quote?: { id: string; status: string } | null;
  carRequest?: { id: string; guestPhone: string | null } | null;
};

/** Client-side upload limits (server enforces URL allowlist + MIME). */
const MAX_BYTES = {
  image: 15 * 1024 * 1024,
  video: 45 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
  raw: 25 * 1024 * 1024,
} as const;

function formatChatStamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function ChatMessageBody({
  body,
  assistant,
  className,
}: {
  body: string;
  assistant?: boolean;
  className?: string;
}) {
  const text = assistant ? displayAssistantBody(body) : body;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const blocks = paragraphs.length > 0 ? paragraphs : [text.trim()];
  return (
    <div className={cn("mt-2 space-y-3", className)}>
      {blocks.map((para, i) => (
        <p key={i} className="whitespace-pre-wrap leading-7 tracking-[0.01em]">
          {para}
        </p>
      ))}
    </div>
  );
}

function maxBytesForFile(file: File): number {
  const t = file.type || "";
  if (t.startsWith("image/")) return MAX_BYTES.image;
  if (t.startsWith("video/")) return MAX_BYTES.video;
  if (t.startsWith("audio/")) return MAX_BYTES.audio;
  return MAX_BYTES.raw;
}

function uploadResourceKind(file: File): "image" | "video" | "audio" | "raw" {
  const t = file.type || "";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  return "raw";
}

async function uploadChatFile(file: File, threadId: string) {
  const resourceKind = uploadResourceKind(file);
  const sigRes = await fetch("/api/upload/chat-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, kind: resourceKind }),
  });
  const raw = await sigRes.text();
  let payload: {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName?: string;
    folder: string;
    uploadUrl?: string;
    error?: string;
  } = {} as (typeof payload);
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    payload = {} as typeof payload;
  }
  const apiErr = typeof payload.error === "string" ? payload.error : "";
  if (sigRes.status === 501) {
    console.warn("[chat-thread-view] Cloudinary signing unavailable (501)", { threadId, resourceKind });
    throw new Error(apiErr || CLOUDINARY_USER_MESSAGE);
  }
  if (!sigRes.ok) {
    console.warn("[chat-thread-view] sign upload failed", sigRes.status, apiErr);
    throw new Error(apiErr || "Could not sign upload. Try again or contact support.");
  }
  const data = payload;
  const cloudName = data.cloudName?.trim() || readPublicCloudinaryCloudName() || "";
  let uploadUrl = data.uploadUrl?.trim();
  if (!uploadUrl && cloudName) {
    uploadUrl =
      resourceKind === "image"
        ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
        : resourceKind === "raw"
          ? `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`
          : `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
  }
  if (!uploadUrl) {
    console.error("[chat-thread-view] missing uploadUrl and cloud name after sign");
    throw new Error("Upload could not be started. Check Cloudinary configuration.");
  }
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", data.apiKey);
  fd.append("timestamp", String(data.timestamp));
  fd.append("signature", data.signature);
  fd.append("folder", data.folder);
  const up = await fetch(uploadUrl, { method: "POST", body: fd });
  if (!up.ok) {
    const err = await up.text();
    throw new Error(err || "Upload failed");
  }
  const json = (await up.json()) as { secure_url: string; public_id: string };
  const mime = file.type || "application/octet-stream";
  let kind: AttachmentKind = AttachmentKind.FILE;
  if (mime.startsWith("image/")) kind = AttachmentKind.IMAGE;
  else if (mime.startsWith("video/")) kind = AttachmentKind.VIDEO;
  else if (mime.startsWith("audio/")) kind = AttachmentKind.AUDIO;
  return {
    url: json.secure_url,
    publicId: json.public_id,
    kind,
    mimeType: file.type || undefined,
  };
}

type Props = {
  controlledThreadId?: string | null;
  showAdminMeta?: boolean;
  /** Admin Live Support Chat: dock customer profile to the right of the thread. */
  adminSplitLayout?: boolean;
};

export function ChatThreadView({ controlledThreadId, showAdminMeta, adminSplitLayout }: Props) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [localThreadId, setLocalThreadId] = useState<string | null>(null);
  const staff = Boolean(session?.user?.role && isSupportStaffRole(session.user.role));
  const admin = Boolean(session?.user?.role && isAdminRole(session.user.role));
  const publicVisitor = controlledThreadId === undefined && !staff;
  const urlThreadId = publicVisitor ? null : searchParams.get("threadId");
  const threadId =
    controlledThreadId !== undefined ? controlledThreadId : localThreadId || urlThreadId;

  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [threadMeta, setThreadMeta] = useState<ChatThreadDto | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const EDIT_WINDOW_MS = 60_000;

  const messagingBlockedForViewer =
    threadMeta?.customer?.messagingBlocked === true &&
    Boolean(session?.user?.id && threadMeta?.customerId === session.user.id);

  const pollUrl = useMemo(() => {
    if (!threadId) return null;
    return `/api/chat/messages?threadId=${encodeURIComponent(threadId)}&limit=80`;
  }, [threadId]);

  const normalizeMessages = useCallback((raw: ChatMessageDto[]) => {
    return raw.map((m) => ({
      ...m,
      editedAt: m.editedAt
        ? typeof m.editedAt === "string"
          ? m.editedAt
          : (m.editedAt as unknown as Date)?.toISOString?.() ?? null
        : null,
      deletedAt: m.deletedAt
        ? typeof m.deletedAt === "string"
          ? m.deletedAt
          : (m.deletedAt as unknown as Date)?.toISOString?.() ?? null
        : null,
    }));
  }, []);

  const clearPublicThreadFromUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    if (!u.searchParams.has("threadId")) return;
    u.searchParams.delete("threadId");
    window.history.replaceState({}, "", `${u.pathname}${u.search}${u.hash}`);
  }, []);

  const resetPublicThread = useCallback(() => {
    setLocalThreadId(null);
    setMessages([]);
    setThreadMeta(null);
    setHasMore(false);
    clearPublicThreadFromUrl();
  }, [clearPublicThreadFromUrl]);

  const load = useCallback(async (overrideThreadId?: string) => {
    const id = overrideThreadId ?? threadId;
    if (!id) return;
    const res = await fetch(`/api/chat/messages?threadId=${encodeURIComponent(id)}&limit=80`);
    if (res.status === 403 || res.status === 404 || res.status === 410) {
      if (publicVisitor) resetPublicThread();
      return;
    }
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: ChatMessageDto[];
      thread: ChatThreadDto | null;
      hasMore?: boolean;
      expired?: boolean;
    };
    if (data.expired || !data.thread) {
      if (publicVisitor) resetPublicThread();
      return;
    }
    if (publicVisitor && isLiveSupportIdleSince(data.thread.lastMessageAt ?? data.messages.at(-1)?.createdAt)) {
      resetPublicThread();
      return;
    }
    setMessages(normalizeMessages(data.messages));
    setThreadMeta(data.thread);
    setHasMore(Boolean(data.hasMore));
    void fetch("/api/chat/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: data.thread.id }),
    }).catch(() => {});
  }, [threadId, normalizeMessages, publicVisitor, resetPublicThread]);

  useChatThreadRealtime(threadId ?? null, load);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!publicVisitor) return;
    clearPublicThreadFromUrl();
  }, [publicVisitor, clearPublicThreadFromUrl]);

  useEffect(() => {
    if (controlledThreadId !== undefined || localThreadId || urlThreadId || staff) return;
    let cancelled = false;
    void fetch("/api/chat/thread")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { threadId?: string | null };
        if (!cancelled && data.threadId) {
          setLocalThreadId(data.threadId);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [controlledThreadId, localThreadId, urlThreadId, staff]);

  useEffect(() => {
    if (!publicVisitor || !threadId) return;
    const tick = () => {
      const last = threadMeta?.lastMessageAt ?? messages.at(-1)?.createdAt;
      if (last && isLiveSupportIdleSince(last)) {
        resetPublicThread();
      }
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [publicVisitor, threadId, threadMeta?.lastMessageAt, messages, resetPublicThread]);

  const loadOlder = useCallback(async () => {
    if (!pollUrl || !threadId || loadingOlder || messages.length === 0 || !hasMore) return;
    const oldestId = messages[0].id;
    const el = messagesContainerRef.current;
    const prevH = el?.scrollHeight ?? 0;
    const prevT = el?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const url = `${pollUrl}&before=${encodeURIComponent(oldestId)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages: ChatMessageDto[];
        hasMore?: boolean;
      };
      const older = normalizeMessages(data.messages);
      setMessages((prev) => [...older, ...prev]);
      setHasMore(Boolean(data.hasMore));
      requestAnimationFrame(() => {
        const c = messagesContainerRef.current;
        if (c) c.scrollTop = prevT + (c.scrollHeight - prevH);
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [pollUrl, threadId, loadingOlder, messages, hasMore, normalizeMessages]);

  useEffect(() => {
    if (!threadId) return;
    void fetch("/api/chat/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    }).catch(() => {});
  }, [threadId]);

  async function send(
    uploaded: Array<{ url: string; publicId: string; kind: AttachmentKind; mimeType?: string }> = [],
    draft?: string,
  ) {
    const text = (draft ?? body).trim();
    if (!text && uploaded.length === 0) return;
    setLoading(true);
    try {
      const attachments = uploaded.map((a) => ({
        url: a.url,
        publicId: a.publicId,
        kind: a.kind,
        mimeType: a.mimeType ?? null,
        durationSec: null,
      }));
      const payload = {
        threadId: threadId ?? undefined,
        body: text,
        attachments,
      };
      let res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = await res.json();
      if ((res.status === 403 || res.status === 410) && publicVisitor) {
        resetPublicThread();
        res = await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, threadId: undefined }),
        });
        data = await res.json();
      }
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setBody("");
      if (data.threadId && controlledThreadId === undefined) {
        setLocalThreadId(data.threadId as string);
        if (publicVisitor) clearPublicThreadFromUrl();
      }
      await load(typeof data.threadId === "string" ? data.threadId : undefined);
      toast.success("Sent");
      if (!staff) {
        window.setTimeout(() => void load(), 900);
        window.setTimeout(() => void load(), 2800);
        window.setTimeout(() => void load(), 6500);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length || !threadId) {
      toast.error(threadId ? "Pick a file" : "Send a message first to start the thread, then attach files.");
      return;
    }
    setUploading(true);
    try {
      const atts = [];
      for (const file of Array.from(files)) {
        const max = maxBytesForFile(file);
        if (file.size > max) {
          toast.error(`File too large (max ${Math.round(max / (1024 * 1024))} MB for this type).`);
          continue;
        }
        const up = await uploadChatFile(file, threadId);
        atts.push({
          url: up.url,
          publicId: up.publicId,
          kind: up.kind,
          mimeType: file.type,
        });
      }
      if (atts.length === 0) return;
      await send(atts);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveEdit(messageId: string) {
    const t = editDraft.trim();
    if (!t) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setEditingId(null);
      await load();
      toast.success("Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function removeMessage(messageId: string) {
    if (!confirm("Delete this message?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await load();
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function canEditMessage(m: ChatMessageDto): boolean {
    if (m.deletedAt) return false;
    if (m.senderType === MessageSenderType.SYSTEM && !staff) return false;
    if (staff) return true;
    if (!session?.user?.id || m.senderUserId !== session.user.id) return false;
    return Date.now() - new Date(m.createdAt).getTime() <= EDIT_WINDOW_MS;
  }

  function canDeleteMessage(): boolean {
    return admin;
  }

  async function toggleBlockCustomer() {
    const id = threadMeta?.customer?.id;
    if (!id || threadMeta.customer?.messagingBlocked === undefined) return;
    setBlocking(true);
    try {
      const res = await setUserMessagingBlocked(id, !threadMeta.customer.messagingBlocked, threadId ?? undefined);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await load();
      const wasBlocked = threadMeta.customer.messagingBlocked;
      toast.success(wasBlocked ? "User unblocked" : "User blocked from messaging");
    } finally {
      setBlocking(false);
    }
  }

  const isAdminMessage = (m: ChatMessageDto) => m.senderType === MessageSenderType.ADMIN;
  const isUserMessage = (m: ChatMessageDto) => m.senderType === MessageSenderType.USER;
  const isAssistantMessage = (m: ChatMessageDto) => m.senderType === MessageSenderType.SYSTEM;

  const assistantActive = threadMeta ? Boolean(threadMeta.assistantActive) : true;

  async function setAssistantHandling(action: "claim" | "release") {
    if (!threadId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/threads/${encodeURIComponent(threadId)}/assistant`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await load();
      toast.success(action === "release" ? "Spark assistant will reply again" : "You’re on this conversation");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function staffSenderLabel(m: ChatMessageDto): string {
    if (!isAdminMessage(m)) return "";
    if (m.sender?.role === "SERVICE_ASSISTANT") return "Assistant";
    return "Team";
  }

  const displayPhone =
    threadMeta?.customer?.phone ??
    threadMeta?.guestPhone ??
    threadMeta?.inquiry?.guestPhone ??
    threadMeta?.carRequest?.guestPhone ??
    null;

  const customerProfileCard =
    showAdminMeta && threadMeta ? (
      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Customer profile</p>
        {threadMeta.customer ? (
          <>
            <p className="mt-3 text-base font-semibold tracking-tight text-white">
              {threadMeta.customer.name ?? "—"}
            </p>
            <p className="mt-1 break-all text-xs text-[var(--brand)]">
              <a href={`mailto:${threadMeta.customer.email}`} className="hover:underline">
                {threadMeta.customer.email}
              </a>
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              <span className="text-zinc-600">Phone</span>{" "}
              <span className="text-zinc-200">{displayPhone ?? "—"}</span>
            </p>
            {threadMeta.customer.role ? (
              <p className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                {threadMeta.customer.role.replaceAll("_", " ")}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/admin/users"
                className="inline-flex h-8 items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-zinc-200 transition hover:border-[var(--brand)]/30 hover:bg-[var(--brand)]/10 hover:text-white"
              >
                Open Users
              </Link>
              {threadMeta.customer.messagingBlocked !== undefined && admin ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-white/12 bg-transparent text-xs transition hover:bg-white/[0.06]"
                  disabled={blocking}
                  onClick={() => void toggleBlockCustomer()}
                >
                  {threadMeta.customer.messagingBlocked ? "Unblock messaging" : "Block messaging"}
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="mt-3 space-y-2 text-xs text-zinc-300">
            <p>
              <span className="text-zinc-600">Guest</span> {threadMeta.guestName ?? "—"}
            </p>
            <p className="break-all">
              <span className="text-zinc-600">Email</span> {threadMeta.guestEmail ?? "—"}
            </p>
            <p>
              <span className="text-zinc-600">Phone</span> {displayPhone ?? "—"}
            </p>
          </div>
        )}
        {threadMeta.car ? (
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-xs">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Vehicle</p>
            <p className="mt-0.5 font-medium text-zinc-200">{threadMeta.car.title}</p>
          </div>
        ) : null}
        {threadMeta.inquiry ? (
          <div className="mt-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-xs text-zinc-400">
            <span className="text-zinc-600">Inquiry</span> {threadMeta.inquiry.type.replaceAll("_", " ")} ·{" "}
            {threadMeta.inquiry.status}
          </div>
        ) : null}
        {threadMeta.lead ? (
          <p className="mt-2 text-[11px] text-zinc-500">
            Lead · {threadMeta.lead.title ?? threadMeta.lead.id} · {threadMeta.lead.stage}
          </p>
        ) : null}
        {threadMeta.quote ? (
          <p className="mt-1 text-[11px] text-zinc-500">Quote · {threadMeta.quote.status}</p>
        ) : null}
      </div>
    ) : null;

  const split = Boolean(adminSplitLayout && showAdminMeta);

  const mine = (m: ChatMessageDto) => (staff ? isAdminMessage(m) : isUserMessage(m));

  const messagesColumn = (
    <>
      <div
        ref={messagesContainerRef}
        className="sda-chat-thread max-h-[min(68vh,680px)] space-y-3.5 overflow-y-auto rounded-2xl border border-zinc-200 p-3 sm:p-4 dark:border-white/[0.06]"
      >
        {hasMore && messages.length > 0 ? (
          <div className="flex justify-center pb-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-white/12 bg-white/[0.03] text-xs text-zinc-300 transition hover:bg-white/[0.06]"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </Button>
          </div>
        ) : null}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-[var(--brand)]/30 bg-[var(--brand)]/10">
              <Image
                src="/brand/logo-emblem.png"
                alt=""
                width={40}
                height={40}
                className="h-9 w-9 object-contain"
              />
            </div>
            <p className="mt-4 text-base font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">Spark is ready when you are</p>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-400">
              Ask how the site works. I will not quote prices, run paid tools, or look up other people.
            </p>
            <div className="mt-5 flex max-w-md flex-wrap justify-center gap-2">
              {SPARK_CHAT_SUGGESTIONS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={loading || messagingBlockedForViewer}
                  onClick={() => void send([], item.text)}
                  className="rounded-full border border-[var(--brand)]/25 bg-[var(--brand)]/10 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-[var(--brand)]/50 hover:bg-[var(--brand)]/15 disabled:opacity-40"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", mine(m) ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[min(100%,34rem)] px-4 py-2.5 text-[15px] leading-relaxed shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)]",
                  mine(m)
                    ? "rounded-2xl rounded-br-md border border-[var(--brand)]/35 bg-gradient-to-br from-[var(--brand)] to-[#0a9fb0] text-zinc-950"
                    : isAssistantMessage(m)
                      ? "rounded-2xl rounded-bl-md border border-zinc-200 bg-white text-zinc-800 dark:border-[var(--brand)]/20 dark:bg-zinc-900/90 dark:text-zinc-100"
                      : "rounded-2xl rounded-bl-md border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-white/10 dark:bg-zinc-800/90 dark:text-zinc-100",
                )}
              >
                <div
                  className={cn(
                    "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11px] font-medium",
                    mine(m) ? "text-zinc-900/65" : "text-zinc-500 dark:text-zinc-400",
                  )}
                >
                  <span>
                    {isAdminMessage(m) ? (
                      <>
                        <span className="mr-1.5 rounded-md bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          {staffSenderLabel(m)}
                        </span>
                        {m.sender?.name ?? ""}
                      </>
                    ) : isUserMessage(m) ? (
                      staff ? "Customer" : "You"
                    ) : isAssistantMessage(m) ? (
                      SPARK_ASSISTANT_LABEL
                    ) : (
                      m.senderType
                    )}
                  </span>
                  <time className="shrink-0 tabular-nums opacity-80" dateTime={m.createdAt}>
                    {formatChatStamp(m.createdAt)}
                  </time>
                </div>
                {m.editedAt ? (
                  <p className={cn("mt-1 text-[10px]", mine(m) ? "text-zinc-900/55" : "text-zinc-500")}>Edited</p>
                ) : null}
                {m.deletedAt ? (
                  <p className="mt-2 italic opacity-70">This message was deleted.</p>
                ) : (
                  <>
                    {m.body && m.body.trim() !== "\u00a0" && editingId !== m.id && (
                      <ChatMessageBody
                        body={m.body.trim()}
                        assistant={isAssistantMessage(m)}
                        className={mine(m) ? "text-zinc-950" : "text-zinc-800 dark:text-zinc-100"}
                      />
                    )}
                    {editingId === m.id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void saveEdit(m.id)}
                            disabled={loading}
                          >
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    {m.attachments.length > 0 ? (
                      <div className="mt-3 flex flex-col gap-2">
                        {m.attachments.map((a) => (
                          <div key={a.id}>
                            {a.kind === AttachmentKind.IMAGE ? (
                              <div className="relative max-h-64 w-full max-w-md overflow-hidden rounded-lg border border-white/10">
                                <Image
                                  src={a.url}
                                  alt=""
                                  width={800}
                                  height={600}
                                  className="h-auto w-full object-contain"
                                />
                              </div>
                            ) : null}
                            {a.kind === AttachmentKind.VIDEO ? (
                              <video
                                controls
                                className="max-h-80 w-full max-w-md rounded-lg border border-white/10"
                                preload="metadata"
                              >
                                <source src={a.url} />
                              </video>
                            ) : null}
                            {a.kind === AttachmentKind.AUDIO ? (
                              <audio controls className="w-full max-w-md" preload="metadata">
                                <source src={a.url} />
                              </audio>
                            ) : null}
                            {a.kind === AttachmentKind.FILE ? (
                              <a
                                href={a.url}
                                className="text-[var(--brand)] underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                {a.mimeType?.includes("pdf") ? "Open PDF" : "Download file"}
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {(canEditMessage(m) || canDeleteMessage()) && editingId !== m.id ? (
                      <div className="mt-2.5 flex items-center justify-end gap-1 border-t border-white/[0.06] pt-2">
                        {canEditMessage(m) ? (
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white/[0.08] hover:text-white"
                            title="Edit message"
                            aria-label="Edit message"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditDraft(m.body.replace(/\u00a0/g, "").trim());
                            }}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {canDeleteMessage() ? (
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-500/15 hover:text-red-300"
                            title="Delete message"
                            aria-label="Delete message"
                            onClick={() => void removeMessage(m.id)}
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={2} />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {messagingBlockedForViewer ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Messaging has been disabled for your account by an administrator. You can still read this conversation.
        </div>
      ) : null}

      {showAdminMeta && threadId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-white/70 px-3 py-2 text-[11px] text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-400">
          <span>
            {assistantActive
              ? "Spark assistant is covering this thread until a teammate replies."
              : "A teammate is handling this thread. The assistant will stay quiet."}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-zinc-200 text-[11px] dark:border-white/15"
            disabled={loading}
            onClick={() => void setAssistantHandling(assistantActive ? "claim" : "release")}
          >
            {assistantActive ? "I’ll take this" : "Release to Spark assistant"}
          </Button>
        </div>
      ) : null}

      <p className="px-1 text-xs font-medium tracking-wide text-zinc-500">
        {assistantActive
          ? `${SPARK_ASSISTANT_LABEL} is on this chat · a teammate can join if needed`
          : "A teammate is on this conversation"}
      </p>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-1.5 shadow-[0_12px_40px_-20px_rgba(20,216,230,0.35)]">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Write a message… Enter to send"
          rows={2}
          disabled={messagingBlockedForViewer}
          className="min-h-[72px] resize-none border-0 bg-transparent px-3 py-2.5 text-[15px] leading-relaxed shadow-none placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-2 py-2">
          <div className="flex flex-wrap items-center gap-1">
            {threadId ? (
              <>
                <label
                  className={cn(
                    "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-transparent text-zinc-500 transition hover:border-white/10 hover:bg-white/[0.06] hover:text-zinc-200",
                    (uploading || messagingBlockedForViewer) && "pointer-events-none opacity-40",
                  )}
                  title="Attach image"
                >
                  <ImageIcon className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploading || messagingBlockedForViewer}
                    onChange={(e) => void onPickFiles(e.target.files)}
                  />
                </label>
                <label
                  className={cn(
                    "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-transparent text-zinc-500 transition hover:border-white/10 hover:bg-white/[0.06] hover:text-zinc-200",
                    (uploading || messagingBlockedForViewer) && "pointer-events-none opacity-40",
                  )}
                  title="Attach document"
                >
                  <FileText className="h-4 w-4" />
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.xlsx,.xls,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    multiple
                    className="hidden"
                    disabled={uploading || messagingBlockedForViewer}
                    onChange={(e) => void onPickFiles(e.target.files)}
                  />
                </label>
              </>
            ) : (
              <span className="px-1 text-xs text-zinc-500">Send your first message, then you can attach files.</span>
            )}
            {uploading ? <span className="text-xs text-zinc-500">Uploading…</span> : null}
          </div>
          <Button
            type="button"
            size="sm"
            className="h-10 gap-1.5 rounded-full bg-[var(--brand)] px-5 font-semibold text-zinc-950 shadow-[0_0_24px_-6px_rgba(20,216,230,0.7)] hover:bg-[var(--brand)]/90"
            disabled={loading || uploading || messagingBlockedForViewer}
            onClick={() => void send()}
          >
            {loading ? (
              "Sending…"
            ) : (
              <>
                <SendHorizontal className="h-4 w-4" />
                Send
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className={split ? "flex min-h-0 flex-col gap-4 lg:flex-row lg:items-stretch" : "space-y-4"}>
      {!split && customerProfileCard}
      {split ? (
        <>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6">{messagesColumn}</div>
          {customerProfileCard ? (
            <aside className="w-full shrink-0 lg:sticky lg:top-2 lg:w-[min(100%,20rem)] lg:self-start lg:border-l lg:border-white/10 lg:pl-4">
              {customerProfileCard}
            </aside>
          ) : null}
        </>
      ) : (
        messagesColumn
      )}
    </div>
  );
}
