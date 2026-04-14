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
  Mic,
  Music2,
  PencilLine,
  SendHorizontal,
  Square,
  Trash2,
  Video,
} from "lucide-react";

import { setUserMessagingBlocked } from "@/actions/chat-moderation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  if (sigRes.status === 501) throw new Error("Cloudinary is not configured.");
  if (!sigRes.ok) throw new Error("Could not sign upload");
  const data = (await sigRes.json()) as {
    timestamp: number;
    signature: string;
    apiKey: string;
    folder: string;
    uploadUrl: string;
  };
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", data.apiKey);
  fd.append("timestamp", String(data.timestamp));
  fd.append("signature", data.signature);
  fd.append("folder", data.folder);
  const up = await fetch(data.uploadUrl, { method: "POST", body: fd });
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
  const urlThreadId = searchParams.get("threadId");
  const [localThreadId, setLocalThreadId] = useState<string | null>(null);
  const threadId =
    controlledThreadId !== undefined ? controlledThreadId : localThreadId || urlThreadId;

  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [threadMeta, setThreadMeta] = useState<ChatThreadDto | null>(null);
  const [body, setBody] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);

  const staff = session?.user?.role && isSupportStaffRole(session.user.role);
  const admin = Boolean(session?.user?.role && isAdminRole(session.user.role));

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

  const load = useCallback(async () => {
    if (!pollUrl) return;
    const res = await fetch(pollUrl);
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: ChatMessageDto[];
      thread: ChatThreadDto;
      hasMore?: boolean;
    };
    setMessages(normalizeMessages(data.messages));
    setThreadMeta(data.thread);
    setHasMore(Boolean(data.hasMore));
  }, [pollUrl, normalizeMessages]);

  useChatThreadRealtime(threadId ?? null, load);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!recording) {
      setRecSeconds(0);
      return;
    }
    const t = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

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
  ) {
    const text = body.trim();
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
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: threadId ?? undefined,
          body: text,
          attachments,
          guestName: session?.user ? undefined : guestName || undefined,
          guestEmail: session?.user ? undefined : guestEmail || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setBody("");
      if (data.threadId && controlledThreadId === undefined) {
        setLocalThreadId(data.threadId as string);
        const u = new URL(window.location.href);
        u.searchParams.set("threadId", data.threadId);
        window.history.replaceState({}, "", u.toString());
      }
      await load();
      toast.success("Sent");
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
    if (staff) return true;
    if (!session?.user?.id || m.senderUserId !== session.user.id) return false;
    return Date.now() - new Date(m.createdAt).getTime() <= EDIT_WINDOW_MS;
  }

  function canDeleteMessage(): boolean {
    return admin;
  }

  async function startVoiceRecording() {
    if (!threadId || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone not available");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size) recordChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || "audio/webm" });
        recordChunksRef.current = [];
        if (blob.size < 256) {
          setRecording(false);
          return;
        }
        if (blob.size > MAX_BYTES.audio) {
          toast.error("Recording too long or too large (max 20 MB).");
          setRecording(false);
          return;
        }
        const ext = blob.type.includes("webm") ? "webm" : "ogg";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
        setUploading(true);
        try {
          const up = await uploadChatFile(file, threadId);
          await send([
            {
              url: up.url,
              publicId: up.publicId,
              kind: up.kind,
              mimeType: file.type,
            },
          ]);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Upload failed");
        } finally {
          setUploading(false);
          setRecording(false);
        }
      };
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Could not access microphone");
    }
  }

  function stopVoiceRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
    mediaRecorderRef.current = null;
  }

  function onVoiceRecordClick() {
    if (uploading || loading || messagingBlockedForViewer) return;
    if (recording) {
      stopVoiceRecording();
      return;
    }
    void startVoiceRecording();
  }

  const recTimeLabel = `${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}`;

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

  const messagesColumn = (
    <>
      <div
        ref={messagesContainerRef}
        className="max-h-[min(70vh,720px)] space-y-3 overflow-y-auto rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.045] to-transparent p-4 shadow-inner"
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
          <p className="text-sm text-zinc-500">No messages yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${isAdminMessage(m) ? "justify-end" : "justify-start"}`}>
              <div
                className={cn(
                  "max-w-[min(100%,520px)] rounded-2xl px-4 py-3 text-sm shadow-lg transition-[box-shadow,transform] duration-200 will-change-transform hover:shadow-xl",
                  isAdminMessage(m)
                    ? "border border-[var(--brand)]/25 bg-gradient-to-br from-[var(--brand)]/18 via-[var(--brand)]/8 to-zinc-950/80 text-zinc-100"
                    : "border border-white/[0.06] bg-zinc-900/70 text-zinc-100 backdrop-blur-sm",
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                  <span className="font-medium text-zinc-400">
                    {isAdminMessage(m) ? (
                      <>
                        <span className="mr-1.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-200">
                          {staffSenderLabel(m)}
                        </span>
                        <span className="text-zinc-500">
                          {m.sender?.name ?? ""}
                          {m.sender?.email ? (
                            <span className="text-zinc-600"> · {m.sender.email}</span>
                          ) : null}
                        </span>
                      </>
                    ) : isUserMessage(m) ? (
                      <span className="text-zinc-400">Customer</span>
                    ) : (
                      <span>{m.senderType}</span>
                    )}
                  </span>
                  <time className="shrink-0 tabular-nums text-zinc-600" dateTime={m.createdAt}>
                    {new Date(m.createdAt).toLocaleString()}
                  </time>
                </div>
                {m.editedAt ? (
                  <p className="mt-1 text-[10px] normal-case text-zinc-600">Edited</p>
                ) : null}
                {m.deletedAt ? (
                  <p className="mt-2 italic text-zinc-500">This message was deleted.</p>
                ) : (
                  <>
                    {m.body && m.body.trim() !== "\u00a0" && editingId !== m.id && (
                      <p className="mt-2 whitespace-pre-wrap text-zinc-200">{m.body.trim()}</p>
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

      {!session?.user && !threadId ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Your name</label>
            <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Email</label>
            <Input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      ) : null}

      {messagingBlockedForViewer ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Messaging has been disabled for your account by an administrator. You can still read this conversation.
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          rows={3}
          disabled={messagingBlockedForViewer}
          className="min-h-[88px] resize-none border-0 bg-transparent px-3 py-2.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
                  title="Attach video"
                >
                  <Video className="h-4 w-4" />
                  <input
                    type="file"
                    accept="video/*"
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
                  title="Attach audio file"
                >
                  <Music2 className="h-4 w-4" />
                  <input
                    type="file"
                    accept="audio/*"
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
                <div className="mx-1 hidden h-5 w-px bg-white/10 sm:block" aria-hidden />
                <button
                  type="button"
                  className={cn(
                    "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-zinc-300 transition",
                    recording
                      ? "border-red-400/40 bg-red-500/20 text-red-100 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]"
                      : "border-white/12 bg-white/[0.05] hover:border-[var(--brand)]/35 hover:bg-[var(--brand)]/10 hover:text-white",
                  )}
                  disabled={uploading || loading || messagingBlockedForViewer}
                  title={recording ? "Stop and send recording" : "Record voice note"}
                  aria-label={recording ? "Stop recording" : "Start voice recording"}
                  aria-pressed={recording}
                  onClick={() => onVoiceRecordClick()}
                >
                  {recording ? (
                    <Square className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
                {recording ? (
                  <span className="text-xs tabular-nums text-red-300/90">{recTimeLabel}</span>
                ) : (
                  <span className="max-w-[10rem] truncate text-[10px] text-zinc-600 sm:max-w-none">
                    Tap mic to record, tap again to send
                  </span>
                )}
              </>
            ) : (
              <span className="px-1 text-[11px] text-zinc-600">Send a message to start — then you can attach files.</span>
            )}
            {uploading ? <span className="text-xs text-zinc-500">Uploading…</span> : null}
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 gap-1.5 rounded-full px-4 shadow-md"
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
    <div className={split ? "flex min-h-0 flex-col gap-4 lg:flex-row lg:items-stretch" : "space-y-6"}>
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
