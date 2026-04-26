import { prisma } from "@/lib/prisma";

/**
 * Operational guard: SUCCESS should reflect verified funds / approved proof, not screenshots alone.
 */
export async function hasPaymentSuccessEvidence(paymentId: string): Promise<boolean> {
  const verification = await prisma.paymentVerification.findUnique({
    where: { paymentId },
    select: { verified: true },
  });
  if (verification?.verified) return true;
  const approvedProof = await prisma.paymentProof.findFirst({
    where: { paymentId, status: "APPROVED" },
    select: { id: true },
  });
  return Boolean(approvedProof);
}
