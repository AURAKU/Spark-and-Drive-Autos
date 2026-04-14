"use client";

import type { SecurityChannel, SecuritySeverity } from "@prisma/client";
import { Copy } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { setUserAccountBlocked, type AdminUserActionState } from "@/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FeedUser = {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  accountBlocked: boolean;
};

export type ProtectionEventRow = {
  id: string;
  createdAt: string;
  severity: SecuritySeverity;
  channel: SecurityChannel;
  title: string;
  detail: string | null;
  userId: string | null;
  email: string | null;
  phone: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  path: string | null;
  metadataJson: unknown;
  user: FeedUser | null;
};

function severityBadgeClass(s: SecuritySeverity) {
  switch (s) {
    case "CRITICAL":
      return "border-red-500/60 text-red-300";
    case "HIGH":
      return "border-orange-500/50 text-orange-200";
    case "MEDIUM":
      return "border-amber-500/40 text-amber-100";
    default:
      return "border-zinc-600 text-zinc-400";
  }
}

function SuspendUserForm({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const [state, action] = useActionState(setUserAccountBlocked, null as AdminUserActionState);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Account suspended");
      window.location.reload();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);
  return (
    <form action={action} className="inline-flex items-center gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="blocked" value="1" />
      <Button type="submit" size="sm" variant="destructive" disabled={disabled}>
        Suspend access
      </Button>
    </form>
  );
}

function UnsuspendUserForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(setUserAccountBlocked, null as AdminUserActionState);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Suspension lifted");
      window.location.reload();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);
  return (
    <form action={action} className="inline-flex items-center gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="blocked" value="0" />
      <Button type="submit" size="sm" variant="outline" className="border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10">
        Lift suspension
      </Button>
    </form>
  );
}

function copyText(label: string, value: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Could not copy"),
  );
}

export function ProtectionCenterHub(props: {
  events: ProtectionEventRow[];
  topIps: Array<{ ip: string; count: number }>;
  byChannel: Array<{ channel: SecurityChannel; count: number }>;
  bySeverity: Array<{ severity: SecuritySeverity; count: number }>;
  recentSuspensions: Array<{ userId: string; at: string; title: string | null }>;
}) {
  const [severity, setSeverity] = useState<SecuritySeverity | "ALL">("ALL");
  const [channel, setChannel] = useState<SecurityChannel | "ALL">("ALL");
  const [textQ, setTextQ] = useState("");

  const filtered = useMemo(() => {
    const q = textQ.trim().toLowerCase();
    return props.events.filter((e) => {
      if (severity !== "ALL" && e.severity !== severity) return false;
      if (channel !== "ALL" && e.channel !== channel) return false;
      if (!q) return true;
      const blob = [
        e.title,
        e.detail,
        e.email,
        e.phone,
        e.ipAddress,
        e.path,
        e.userId,
        e.userAgent,
        e.user?.email,
        e.user?.phone,
        e.user?.role,
        e.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [props.events, severity, channel, textQ]);

  function usersHubHref(e: ProtectionEventRow): string {
    const key = (e.user?.email ?? e.email ?? e.userId ?? "").trim();
    if (!key) return "/admin/users";
    return `/admin/users?q=${encodeURIComponent(key)}`;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.07] via-transparent to-transparent p-5">
        <h2 className="text-sm font-semibold text-amber-100">Mission · detection &amp; response</h2>
        <p className="mt-2 max-w-4xl text-xs leading-relaxed text-zinc-400">
          This console aggregates automated signals across authentication, API abuse patterns, payments, webhooks, and
          privileged admin actions — similar to a CCTV control room for digital behaviour. Use it to spot repeat
          offenders, correlate IP addresses with accounts, and decide when to suspend platform access. It does not
          replace perimeter security (firewall, bot management, Paystack dashboard); it is your internal evidence trail
          and triage queue.
        </p>
        <ul className="mt-3 grid gap-2 text-[11px] text-zinc-500 sm:grid-cols-2 lg:grid-cols-3">
          <li className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">Failed logins &amp; OAuth blocks</li>
          <li className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">Rate limits &amp; checkout abuse</li>
          <li className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">Payment init / webhook anomalies</li>
          <li className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">Chat access denials &amp; spam bursts</li>
          <li className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">Password reset &amp; token misuse</li>
          <li className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">Admin suspensions &amp; restores</li>
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Last 24h — by channel</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {props.byChannel.map((c) => (
              <li key={c.channel}>
                <Badge variant="outline" className="border-white/15 text-xs text-zinc-300">
                  {c.channel}: {c.count}
                </Badge>
              </li>
            ))}
            {props.byChannel.length === 0 ? <li className="text-xs text-zinc-600">No events yet.</li> : null}
          </ul>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-semibold text-white">Last 24h — by severity</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {props.bySeverity.map((s) => (
              <li key={s.severity}>
                <Badge variant="outline" className={cn("text-xs", severityBadgeClass(s.severity))}>
                  {s.severity}: {s.count}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[min(100%,14rem)] flex-1 space-y-1">
              <label className="text-[11px] text-zinc-500" htmlFor="sec-feed-search">
                Search feed
              </label>
              <Input
                id="sec-feed-search"
                value={textQ}
                onChange={(e) => setTextQ(e.target.value)}
                placeholder="IP, email, path, title, user id…"
                className="h-9 border-white/12 bg-black/35 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-500">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SecuritySeverity | "ALL")}
                className="h-9 rounded-lg border border-white/15 bg-black/40 px-2 text-sm text-white"
              >
                <option value="ALL">All</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-500">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as SecurityChannel | "ALL")}
                className="h-9 rounded-lg border border-white/15 bg-black/40 px-2 text-sm text-white"
              >
                <option value="ALL">All</option>
                {(
                  ["AUTH", "PAYMENT", "WEBHOOK", "RATE_LIMIT", "API", "ADMIN", "FRAUD", "MISCONFIG"] as SecurityChannel[]
                ).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-zinc-600 sm:ml-auto">
              Showing {filtered.length} of {props.events.length} loaded events
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Network</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const uid = e.userId ?? e.user?.id;
                  const blocked = e.user?.accountBlocked;
                  return (
                    <tr key={e.id} className="border-b border-white/5 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">{e.createdAt.slice(0, 19)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={cn("text-[10px]", severityBadgeClass(e.severity))}>
                          {e.severity}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{e.channel}</td>
                      <td className="max-w-[280px] px-3 py-2">
                        <p className="font-medium text-zinc-200">{e.title}</p>
                        {e.detail ? <p className="mt-0.5 text-xs text-zinc-600">{e.detail}</p> : null}
                        {e.path ? <p className="mt-0.5 font-mono text-[10px] text-zinc-600">{e.path}</p> : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-400">
                        {e.user ? (
                          <div className="space-y-0.5">
                            <Link
                              href={usersHubHref(e)}
                              className="block font-mono text-[var(--brand)] hover:underline"
                            >
                              {e.user.email}
                            </Link>
                            {e.user.phone ? <span className="block text-zinc-500">{e.user.phone}</span> : null}
                            <span className="text-zinc-600">{e.user.role}</span>
                            {blocked ? <Badge variant="destructive">Suspended</Badge> : null}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {e.email ? <span className="block">{e.email}</span> : null}
                            {e.phone ? <span className="block">{e.phone}</span> : null}
                            {uid ? (
                              <Link
                                href={usersHubHref(e)}
                                className="font-mono text-[10px] text-[var(--brand)] hover:underline"
                              >
                                id {uid.slice(0, 8)}…
                              </Link>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="max-w-[200px] px-3 py-2 font-mono text-[10px] text-zinc-500">
                        <div className="flex items-start gap-1">
                          <span className="min-w-0 break-all">IP {e.ipAddress ?? "—"}</span>
                          {e.ipAddress && e.ipAddress !== "unknown" ? (
                            <button
                              type="button"
                              className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                              title="Copy IP"
                              aria-label="Copy IP address"
                              onClick={() => copyText("IP", e.ipAddress!)}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                        {e.userAgent ? <div className="mt-1 line-clamp-3 break-all opacity-80">{e.userAgent}</div> : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          {uid && !blocked ? <SuspendUserForm userId={uid} disabled={false} /> : null}
                          {uid && blocked ? <UnsuspendUserForm userId={uid} /> : null}
                          {uid ? (
                            <Link href={usersHubHref(e)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                              Open in Users
                            </Link>
                          ) : (
                            <Link href="/admin/users" className={buttonVariants({ variant: "outline", size: "sm" })}>
                              Users hub
                            </Link>
                          )}
                          <button
                            type="button"
                            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 text-[11px] text-zinc-500")}
                            onClick={() => copyText("Event id", e.id)}
                          >
                            Copy event id
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-white">Top IPs (7d)</h2>
            <p className="mt-1 text-[11px] text-zinc-500">Frequent sources — correlate with auth and payment noise.</p>
            <ol className="mt-3 space-y-2 text-sm text-zinc-300">
              {props.topIps.length === 0 ? <li className="text-zinc-600">No data.</li> : null}
              {props.topIps.map((r) => (
                <li key={r.ip} className="flex items-center justify-between gap-2 font-mono text-xs">
                  <span className="truncate">{r.ip}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-zinc-500">{r.count}</span>
                    <button
                      type="button"
                      className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
                      title="Copy IP"
                      aria-label="Copy IP"
                      onClick={() => copyText("IP", r.ip)}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold text-white">Recent admin suspensions</h2>
            <ul className="mt-2 space-y-2 text-xs text-zinc-400">
              {props.recentSuspensions.length === 0 ? <li className="text-zinc-600">None in 24h.</li> : null}
              {props.recentSuspensions.map((s) => (
                <li key={`${s.userId}-${s.at}`}>
                  <Link
                    href={`/admin/users?q=${encodeURIComponent(s.userId)}`}
                    className="text-[var(--brand)] hover:underline"
                  >
                    User {s.userId.slice(0, 8)}…
                  </Link>
                  <span className="block text-zinc-600">{s.at.slice(0, 16)}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
