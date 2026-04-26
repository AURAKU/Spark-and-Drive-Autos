import { isAdminRole } from "@/auth";
import { PartsFinderMembershipStatus, PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";
import type { MembershipAccessSnapshot, PartsFinderAccessLevel } from "@/lib/parts-finder/search-types";

const MEMBERSHIP_WINDOW_DAYS = 30;

export class PartsFinderAccessError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly redirectTo: string,
    public readonly code:
      | "UNAUTHENTICATED"
      | "UPSSELL_ONLY"
      | "INACTIVE"
      | "PENDING_PAYMENT"
      | "PENDING_APPROVAL"
      | "EXPIRED"
      | "SUSPENDED"
      | "FORBIDDEN",
  ) {
    super(message);
  }
}

function buildActivationWindows(paymentDates: Date[]) {
  const sorted = [...paymentDates].sort((a, b) => a.getTime() - b.getTime());
  let cursor: Date | null = null;
  for (const paidAt of sorted) {
    const start: Date = cursor && cursor.getTime() > paidAt.getTime() ? cursor : paidAt;
    const end = new Date(start.getTime() + MEMBERSHIP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    cursor = end;
  }
  return cursor;
}

export async function loadMembershipSnapshotForUser(userId: string): Promise<MembershipAccessSnapshot> {
  const [membership, payments, latestPayment] = await Promise.all([
    prisma.partsFinderMembership.findFirst({
      where: { userId },
      orderBy: { endsAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { userId, paymentType: "PARTS_FINDER_MEMBERSHIP", status: "SUCCESS" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.payment.findFirst({
      where: { userId, paymentType: "PARTS_FINDER_MEMBERSHIP" },
      orderBy: { createdAt: "desc" },
      select: { status: true, createdAt: true },
    }),
  ]);

  const now = new Date();

  const paymentWindowEndsAt = buildActivationWindows(payments.map((p) => p.createdAt));
  const paymentWindowStartsAt = payments.length > 0 ? payments[0].createdAt : null;
  const status: PartsFinderMembershipStatus | null = membership?.status ?? null;
  const activeFrom = membership?.startsAt ?? paymentWindowStartsAt;
  const activeUntil = membership?.endsAt ?? paymentWindowEndsAt;
  const suspensionReason = membership?.status === "SUSPENDED" ? membership.reason ?? "Suspended by admin." : null;
  const hasPendingPayment = Boolean(
    latestPayment &&
      (latestPayment.status === PaymentStatus.PENDING ||
        latestPayment.status === PaymentStatus.AWAITING_PROOF ||
        latestPayment.status === PaymentStatus.PROCESSING ||
        latestPayment.status === PaymentStatus.UNDER_REVIEW),
  );

  if (status === "SUSPENDED") {
    return {
      userId,
      state: "SUSPENDED",
      allowActivation: false,
      allowSearch: false,
      allowResults: false,
      activeFrom: activeFrom?.toISOString() ?? null,
      activeUntil: activeUntil?.toISOString() ?? null,
      suspensionReason,
      renewalRequired: false,
    };
  }

  if (hasPendingPayment) {
    return {
      userId,
      state: "PENDING_PAYMENT",
      allowActivation: true,
      allowSearch: false,
      allowResults: false,
      activeFrom: activeFrom?.toISOString() ?? null,
      activeUntil: activeUntil?.toISOString() ?? null,
      suspensionReason: null,
      renewalRequired: false,
    };
  }

  if (!activeUntil || !activeFrom) {
    return {
      userId,
      state: "INACTIVE",
      allowActivation: true,
      allowSearch: false,
      allowResults: false,
      activeFrom: null,
      activeUntil: null,
      suspensionReason: null,
      renewalRequired: false,
    };
  }

  if (status === "EXPIRED" || activeUntil.getTime() <= now.getTime()) {
    return {
      userId,
      state: "EXPIRED",
      allowActivation: true,
      allowSearch: false,
      allowResults: false,
      activeFrom: activeFrom?.toISOString() ?? null,
      activeUntil: activeUntil.toISOString(),
      suspensionReason: null,
      renewalRequired: true,
    };
  }

  return {
    userId,
    state: "ACTIVE",
    allowActivation: true,
    allowSearch: true,
    allowResults: true,
    activeFrom: activeFrom?.toISOString() ?? null,
    activeUntil: activeUntil.toISOString(),
    suspensionReason: null,
    renewalRequired: false,
  };
}

export async function getPartsFinderAccessSnapshot(): Promise<MembershipAccessSnapshot> {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return {
      userId: null,
      state: "UPSELL_ONLY",
      allowActivation: false,
      allowSearch: false,
      allowResults: false,
      activeFrom: null,
      activeUntil: null,
      suspensionReason: null,
      renewalRequired: false,
    };
  }
  return loadMembershipSnapshotForUser(session.user.id);
}

export async function assertPartsFinderAccess(level: PartsFinderAccessLevel) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    throw new PartsFinderAccessError(
      "Sign in required for this Parts Finder action.",
      401,
      "/parts-finder",
      "UNAUTHENTICATED",
    );
  }
  if (level === "ADMIN") {
    if (!session.user.role || !isAdminRole(session.user.role)) {
      throw new PartsFinderAccessError("Admin privileges required.", 403, "/dashboard", "FORBIDDEN");
    }
    return { session, snapshot: await loadMembershipSnapshotForUser(session.user.id) };
  }
  const settings = await prisma.partsFinderSettings.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { active: true },
  });
  if (settings && settings.active === false) {
    throw new PartsFinderAccessError(
      "Parts Finder is temporarily disabled by admin.",
      503,
      "/parts-finder",
      "FORBIDDEN",
    );
  }
  const snapshot = await loadMembershipSnapshotForUser(session.user.id);

  if (snapshot.state === "SUSPENDED") {
    throw new PartsFinderAccessError(
      snapshot.suspensionReason ?? "Membership suspended by admin.",
      403,
      "/dashboard/parts-finder?status=suspended",
      "SUSPENDED",
    );
  }
  if ((level === "SEARCH" || level === "RESULTS") && snapshot.state === "EXPIRED") {
    throw new PartsFinderAccessError(
      "Membership expired. Renewal required.",
      402,
      "/dashboard/parts-finder?status=renew",
      "EXPIRED",
    );
  }
  if ((level === "SEARCH" || level === "RESULTS") && snapshot.state === "PENDING_PAYMENT") {
    throw new PartsFinderAccessError(
      "Membership payment is still pending confirmation.",
      402,
      "/parts-finder/activate?status=pending-payment",
      "PENDING_PAYMENT",
    );
  }
  if ((level === "SEARCH" || level === "RESULTS") && snapshot.state !== "ACTIVE") {
    throw new PartsFinderAccessError(
      "Activate membership to use advanced parts search.",
      402,
      "/dashboard/parts-finder?status=activate",
      "INACTIVE",
    );
  }

  return { session, snapshot };
}

export async function requirePartsFinderUser(callbackUrl = "/dashboard/parts-finder") {
  const session = await safeAuth();
  if (!session?.user?.id) {
    throw new PartsFinderAccessError(
      "Sign in required.",
      401,
      `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      "UNAUTHENTICATED",
    );
  }
  return session;
}

export async function requirePartsFinderAdmin() {
  return assertPartsFinderAccess("ADMIN");
}

export async function requirePartsFinderMembership(level: "SEARCH" | "RESULTS" = "RESULTS") {
  return assertPartsFinderAccess(level);
}

export async function requirePartsFinderActivationAccess() {
  return assertPartsFinderAccess("ACTIVATION");
}
