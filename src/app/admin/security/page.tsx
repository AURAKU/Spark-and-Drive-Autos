import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProtectionCenterHub } from "@/components/admin/protection-center-hub";
import { PageHeading } from "@/components/typography/page-headings";
import { isAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Security surveillance",
  description:
    "Detection and response hub for auth abuse, payments, webhooks, and admin actions — correlate IPs and accounts.",
};

const FEED_LIMIT = 200;
const WINDOW_MS = 7 * 864e5;

export default async function AdminProtectionCenterPage() {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) {
    redirect("/admin");
  }

  const since = new Date(Date.now() - WINDOW_MS);
  const since24h = new Date(Date.now() - 864e5);

  const [feed, topIps, byChannel, bySeverity, recentBlocks] = await Promise.all([
    prisma.securityObservation.findMany({
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      include: {
        user: { select: { id: true, email: true, phone: true, role: true, accountBlocked: true } },
      },
    }),
    prisma.securityObservation.groupBy({
      by: ["ipAddress"],
      where: {
        createdAt: { gte: since },
        ipAddress: { not: null },
        NOT: { ipAddress: { in: ["unknown", ""] } },
      },
      _count: { _all: true },
    }),
    prisma.securityObservation.groupBy({
      by: ["channel"],
      where: { createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
    prisma.securityObservation.groupBy({
      by: ["severity"],
      where: { createdAt: { gte: since24h } },
      _count: { _all: true },
    }),
    prisma.securityObservation.findMany({
      where: {
        channel: "ADMIN",
        title: { contains: "suspended", mode: "insensitive" },
        createdAt: { gte: since24h },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { userId: true, createdAt: true, title: true },
    }),
  ]);

  const serialized = feed.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    severity: r.severity,
    channel: r.channel,
    title: r.title,
    detail: r.detail,
    userId: r.userId,
    email: r.email,
    phone: r.phone,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    path: r.path,
    metadataJson: r.metadataJson,
    user: r.user
      ? {
          id: r.user.id,
          email: r.user.email,
          phone: r.user.phone,
          role: r.user.role,
          accountBlocked: r.user.accountBlocked,
        }
      : null,
  }));

  const topIpsSerialized = topIps
    .filter((r) => r.ipAddress)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 14)
    .map((r) => ({ ip: r.ipAddress as string, count: r._count._all }));

  return (
    <div>
      <PageHeading variant="dashboard">Security surveillance</PageHeading>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Protection Center · detection</p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
        Central feed for suspicious and high-risk activity: failed logins, rate limits, payment anomalies, webhook
        verification issues, checkout edge cases, and admin-driven account suspensions. Each row captures identifiers
        your security team can use to correlate behaviour — user id, email, phone where known, client IP, path, and user
        agent (best-effort from headers; complement with WAF, IDS, and provider dashboards). Suspend or lift access from
        the feed, then confirm in{" "}
        <Link href="/admin/users" className="text-[var(--brand)] hover:underline">
          Users
        </Link>
        ,{" "}
        <Link href="/admin/payments/intelligence" className="text-[var(--brand)] hover:underline">
          Payment intelligence
        </Link>
        , and the{" "}
        <Link href="/admin/audit" className="text-[var(--brand)] hover:underline">
          Audit log
        </Link>
        .
      </p>

      <div className="mt-8">
        <ProtectionCenterHub
          events={serialized}
          topIps={topIpsSerialized}
          byChannel={byChannel.map((c) => ({ channel: c.channel, count: c._count._all }))}
          bySeverity={bySeverity.map((s) => ({ severity: s.severity, count: s._count._all }))}
          recentSuspensions={recentBlocks
            .filter((b) => b.userId)
            .map((b) => ({ userId: b.userId as string, at: b.createdAt.toISOString(), title: b.title }))}
        />
      </div>
    </div>
  );
}
