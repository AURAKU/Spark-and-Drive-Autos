import type { PartsFinderApprovalMode } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PersistPartsFinderSettingsInput = {
  activationPriceMinor: number;
  activationDurationDays: number;
  approvalMode: PartsFinderApprovalMode;
  featureEnabled: boolean;
  requireManualReviewBelow: number;
};

/**
 * Server-authoritative settings write path for Parts Finder admin operations.
 * This keeps page actions and API handlers consistent and auditable.
 */
export async function persistPartsFinderSettings(params: {
  actorId: string;
  input: PersistPartsFinderSettingsInput;
}) {
  const current = await prisma.partsFinderSettings.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  const saved = current
    ? await prisma.partsFinderSettings.update({
        where: { id: current.id },
        data: {
          activationPriceMinor: params.input.activationPriceMinor,
          activationDurationDays: params.input.activationDurationDays,
          renewalPriceMinor: params.input.activationPriceMinor,
          renewalDurationDays: params.input.activationDurationDays,
          approvalMode: params.input.approvalMode,
          active: params.input.featureEnabled,
          requireManualReviewBelow: params.input.requireManualReviewBelow,
        },
      })
    : await prisma.partsFinderSettings.create({
        data: {
          currencyCode: "GHS",
          activationPriceMinor: params.input.activationPriceMinor,
          activationDurationDays: params.input.activationDurationDays,
          renewalPriceMinor: params.input.activationPriceMinor,
          renewalDurationDays: params.input.activationDurationDays,
          approvalMode: params.input.approvalMode,
          active: params.input.featureEnabled,
          requireManualReviewBelow: params.input.requireManualReviewBelow,
          suspiciousPhraseThreshold: 2,
        },
      });

  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: "parts_finder.settings.updated",
      entityType: "PartsFinderSettings",
      entityId: saved.id,
      metadataJson: {
        activationPriceMinor: params.input.activationPriceMinor,
        activationDurationDays: params.input.activationDurationDays,
        renewalPriceMinor: params.input.activationPriceMinor,
        renewalDurationDays: params.input.activationDurationDays,
        approvalMode: params.input.approvalMode,
        featureEnabled: params.input.featureEnabled,
        requireManualReviewBelow: params.input.requireManualReviewBelow,
        pricingAppliesTo: "future_activations_and_renewals_only",
      },
    },
  });

  return saved;
}
