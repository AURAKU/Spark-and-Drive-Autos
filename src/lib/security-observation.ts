import type { Prisma, SecurityChannel, SecuritySeverity } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type RecordSecurityObservationInput = {
  severity: SecuritySeverity;
  channel: SecurityChannel;
  title: string;
  detail?: string | null;
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  path?: string | null;
  metadataJson?: Prisma.InputJsonValue;
};

/**
 * Append-only security feed for the admin Protection Center.
 * Never throws — failures are logged so auth/payment flows are not blocked.
 */
export async function recordSecurityObservation(input: RecordSecurityObservationInput): Promise<void> {
  try {
    await prisma.securityObservation.create({
      data: {
        severity: input.severity,
        channel: input.channel,
        title: input.title.slice(0, 500),
        detail: input.detail ? input.detail.slice(0, 8000) : null,
        userId: input.userId ?? null,
        email: input.email ? input.email.slice(0, 320) : null,
        phone: input.phone ? input.phone.slice(0, 40) : null,
        ipAddress: input.ipAddress ? input.ipAddress.slice(0, 120) : null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 512) : null,
        path: input.path ? input.path.slice(0, 500) : null,
        metadataJson: input.metadataJson ?? undefined,
      },
    });
  } catch (e) {
    console.error("[recordSecurityObservation]", e);
  }
}
