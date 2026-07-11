import { parseDutyAdminSettings } from "@/lib/duty-admin/settings";
import { ensureCountryConfig } from "@/lib/duty-intelligence/config-loader";
import { prisma } from "@/lib/prisma";

export type PublicCalculatorAccess = {
  enabled: boolean;
  disclaimer: string;
  maxRequestsPerHour: number;
  defaultEstimateBandPct: number;
};

export async function getPublicCalculatorAccess(countryCode: "GH" = "GH"): Promise<PublicCalculatorAccess> {
  const config = await ensureCountryConfig(countryCode);
  if (!config) {
    return {
      enabled: false,
      disclaimer: "",
      maxRequestsPerHour: 60,
      defaultEstimateBandPct: 10,
    };
  }

  const row = await prisma.dutyCountryConfig.findUnique({
    where: { id: config.countryConfigId },
    select: { configJson: true },
  });
  const settings = parseDutyAdminSettings(row?.configJson);

  return {
    enabled: settings.publicCalculatorEnabled,
    disclaimer: settings.disclaimer,
    maxRequestsPerHour: settings.maxPublicRequestsPerHour,
    defaultEstimateBandPct: settings.defaultEstimateBandPct,
  };
}

export async function assertPublicCalculatorEnabled(countryCode: "GH" = "GH"): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await getPublicCalculatorAccess(countryCode);
  if (!access.enabled) {
    return {
      ok: false,
      message: "The duty calculator is temporarily unavailable. Please contact Spark & Drive Autos for assistance.",
    };
  }
  return { ok: true };
}
