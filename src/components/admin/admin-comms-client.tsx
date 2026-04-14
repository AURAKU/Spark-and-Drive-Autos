"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PrivateUserMessageCard } from "@/components/admin/private-user-message-card";
import { ChatThreadView } from "@/components/chat/chat-thread-view";
import { SystemAnnouncementCard } from "@/app/admin/order-inquiries/system-announcement-card";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";

export type ThreadListItem = {
  id: string;
  subject: string | null;
  lastMessageAt: string | null;
  unreadForAdmin: number;
  guestName: string | null;
  guestEmail: string | null;
  customer: { id: string; name: string | null; email: string | null } | null;
  car: { id: string; title: string; slug: string } | null;
  inquiry: { id: string; type: string; status: string } | null;
};

type HubView = "chats" | "inquiry" | "sourcing" | "leads" | "quotes" | "broadcast";

export function AdminCommsClient({
  threads,
  initialThreadId,
  inquiries,
  users,
  initialView,
  carRequests,
  leads,
  quotes,
  recentAnnouncements,
}: {
  threads: ThreadListItem[];
  initialThreadId?: string | null;
  inquiries: Array<{
    id: string;
    type: string;
    status: string;
    message: string;
    carTitle: string | null;
    threadId: string | null;
    createdAt: string;
  }>;
  users: Array<{ id: string; email: string; name: string | null }>;
  initialView?: HubView;
  carRequests: Array<{
    id: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    brand: string;
    model: string;
    status: string;
    threadId: string | null;
    createdAt: string;
    hasUser: boolean;
    userEmail: string | null;
  }>;
  leads: Array<{
    id: string;
    stage: string;
    title: string | null;
    customerEmail: string | null;
    threadId: string | null;
    updatedAt: string;
  }>;
  quotes: Array<{
    id: string;
    status: string;
    total: number | null;
    currency: string;
    customerEmail: string | null;
    carTitle: string | null;
    threadId: string | null;
    createdAt: string;
  }>;
  recentAnnouncements: Array<{
    id: string;
    title: string;
    body: string | null;
    recipientCount: number;
    createdAt: string;
  }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<HubView>(initialView ?? "chats");
  const [selected, setSelected] = useState<string | null>(
    initialThreadId && threads.some((t) => t.id === initialThreadId)
      ? initialThreadId
      : threads[0]?.id ?? null,
  );
  const [q, setQ] = useState("");

  useEffect(() => {
    setView(initialView ?? "chats");
  }, [initialView]);

  function pushView(next: HubView) {
    setView(next);
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", next);
    if (next !== "chats") {
      p.delete("thread");
    }
    router.push(`/admin/comms?${p.toString()}`, { scroll: false });
  }

  function selectThread(id: string) {
    setSelected(id);
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "chats");
    p.set("thread", id);
    router.push(`/admin/comms?${p.toString()}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return threads;
    return threads.filter((t) => {
      const blob = [
        t.subject,
        t.customer?.email,
        t.customer?.name,
        t.guestEmail,
        t.guestName,
        t.car?.title,
        t.inquiry?.type,
        t.inquiry?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(s);
    });
  }, [threads, q]);

  useEffect(() => {
    if (selected && !filtered.some((t) => t.id === selected)) {
      setSelected(filtered[0]?.id ?? null);
    }
  }, [filtered, selected]);

  const tab = (id: HubView, label: string) => (
    <button
      key={id}
      type="button"
      className={`rounded-xl px-3.5 py-2 text-xs font-medium transition ${
        view === id
          ? "bg-[var(--brand)] text-black shadow-[0_0_20px_rgba(34,211,238,0.25)]"
          : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
      }`}
      onClick={() => pushView(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-8 space-y-4">
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-1 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm">
        {tab("chats", "Conversations")}
        {tab("inquiry", "Customer Inquiry")}
        {tab("sourcing", "Order inquiries")}
        {tab("leads", "Leads")}
        {tab("quotes", "Quotes")}
        {tab("broadcast", "Broadcasts & direct")}
      </div>

      {view === "inquiry" ? (
        <div className="space-y-3">
          {inquiries.length === 0 ? (
            <p className="text-sm text-zinc-500">No customer inquiries yet.</p>
          ) : (
            inquiries.map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
                <p className="text-xs font-mono text-zinc-500">{r.id}</p>
                <p className="mt-2 text-white">{r.type.replaceAll("_", " ")}</p>
                <p className="mt-2 text-zinc-400">{r.message}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {r.carTitle ?? "General"} · {r.status} · {new Date(r.createdAt).toLocaleString()}
                </p>
                {r.threadId ? (
                  <button
                    type="button"
                    className="mt-3 text-sm font-medium text-[var(--brand)] hover:underline"
                    onClick={() => {
                      pushView("chats");
                      selectThread(r.threadId!);
                    }}
                  >
                    Open conversation →
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-amber-200/80">No thread linked (legacy row).</p>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}

      {view === "sourcing" ? (
        <div className="space-y-3">
          {carRequests.length === 0 ? (
            <p className="text-sm text-zinc-500">No sourcing requests yet.</p>
          ) : (
            carRequests.map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
                <p className="font-medium text-white">
                  {r.brand} {r.model}
                </p>
                <p className="mt-2 text-zinc-400">
                  {r.guestName} · {r.guestEmail} · {r.guestPhone}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {r.status} · {new Date(r.createdAt).toLocaleString()}
                  {r.hasUser ? ` · Account: ${r.userEmail}` : ""}
                </p>
                {r.threadId ? (
                  <button
                    type="button"
                    className="mt-3 text-sm font-medium text-[var(--brand)] hover:underline"
                    onClick={() => {
                      pushView("chats");
                      selectThread(r.threadId!);
                    }}
                  >
                    Open conversation →
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-zinc-500">No chat thread yet — customer may not have messaged.</p>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}

      {view === "leads" ? (
        <div className="space-y-3">
          {leads.length === 0 ? (
            <p className="text-sm text-zinc-500">No leads yet.</p>
          ) : (
            leads.map((l) => (
              <div
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm"
              >
                <div>
                  <p className="font-medium text-white">{l.title ?? "—"}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {l.stage} · {l.customerEmail ?? "No customer"} · {new Date(l.updatedAt).toLocaleString()}
                  </p>
                </div>
                {l.threadId ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-[var(--brand)] hover:underline"
                    onClick={() => {
                      pushView("chats");
                      selectThread(l.threadId!);
                    }}
                  >
                    Open chat
                  </button>
                ) : (
                  <span className="text-xs text-zinc-600">No thread</span>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}

      {view === "quotes" ? (
        <div className="space-y-3">
          {quotes.length === 0 ? (
            <p className="text-sm text-zinc-500">No quotes yet.</p>
          ) : (
            quotes.map((q) => (
              <div
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm"
              >
                <div>
                  <p className="font-medium text-white">{q.carTitle ?? "Quote"}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {q.status}
                    {q.total != null ? ` · ${formatMoney(q.total, q.currency)}` : ""} · {q.customerEmail ?? "—"}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-600">{new Date(q.createdAt).toLocaleString()}</p>
                </div>
                {q.threadId ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-[var(--brand)] hover:underline"
                    onClick={() => {
                      pushView("chats");
                      selectThread(q.threadId!);
                    }}
                  >
                    Open chat
                  </button>
                ) : (
                  <span className="text-xs text-zinc-600">No thread</span>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}

      {view === "broadcast" ? (
        <div className="space-y-5">
          <PrivateUserMessageCard users={users} />
          <SystemAnnouncementCard recent={recentAnnouncements} />
        </div>
      ) : null}

      {view === "chats" ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,min(100%,360px))_minmax(0,1fr)]">
            <div className="flex max-h-[min(78vh,800px)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.01] shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
              <div className="border-b border-white/[0.06] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Inbox · {filtered.length}
                  </p>
                </div>
                <label className="sr-only" htmlFor="thread-search">
                  Search conversations
                </label>
                <Input
                  id="thread-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search email, vehicle, inquiry…"
                  className="mt-2 h-9 border-white/[0.08] bg-black/25 text-sm placeholder:text-zinc-600"
                />
              </div>
              <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <li className="px-3 py-10 text-center">
                    <p className="text-sm font-medium text-zinc-400">No matches</p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                      Try a different search or clear the filter.
                    </p>
                  </li>
                ) : (
                  filtered.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => selectThread(t.id)}
                        className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          selected === t.id
                            ? "bg-white/[0.09] text-white shadow-inner ring-1 ring-[var(--brand)]/30"
                            : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 min-w-0 flex-1 font-medium leading-snug text-zinc-100">
                            {t.subject ?? "Live support"}
                          </p>
                          {t.unreadForAdmin > 0 ? (
                            <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[10px] font-bold text-black">
                              {t.unreadForAdmin > 9 ? "9+" : t.unreadForAdmin}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {t.customer?.email ?? t.guestEmail ?? "Guest"}
                          {t.car ? ` · ${t.car.title}` : ""}
                        </p>
                        {t.inquiry ? (
                          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                            Inquiry · {t.inquiry.type.replaceAll("_", " ")}
                          </p>
                        ) : null}
                        {t.lastMessageAt ? (
                          <p className="mt-1 text-[10px] tabular-nums text-zinc-600">
                            {new Date(t.lastMessageAt).toLocaleString()}
                          </p>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="flex min-h-[min(78vh,640px)] flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] via-transparent to-black/20 p-3 shadow-[0_12px_48px_rgba(0,0,0,0.28)] sm:p-5">
              {selected ? (
                <ChatThreadView key={selected} controlledThreadId={selected} showAdminMeta adminSplitLayout />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                  <p className="text-sm font-medium text-zinc-400">Select a thread</p>
                  <p className="mt-1 max-w-sm text-xs text-zinc-600">
                    Choose a conversation to read and reply. All Live Support Chat threads—including inquiries, order
                    inquiries, leads, quotes, and direct messages—appear in this list.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
