import { NextResponse } from "next/server";

import { PartsFinderAccessError, requirePartsFinderAdmin } from "@/lib/parts-finder/access";
import { getPartsFinderActivationSnapshot } from "@/lib/parts-finder/pricing";
import { partsFinderSettingsSchema } from "@/lib/parts-finder/schemas";
import { persistPartsFinderSettings } from "@/lib/parts-finder/settings-persistence";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requirePartsFinderAdmin();
    const [settings, activationSnapshot] = await Promise.all([
      prisma.partsFinderSettings.findFirst({ orderBy: { updatedAt: "desc" } }),
      getPartsFinderActivationSnapshot(),
    ]);
    return NextResponse.json({
      ok: true,
      settings: settings ? { ...settings, isActive: settings.active } : null,
      activationSnapshot,
    });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load settings." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await requirePartsFinderAdmin();
    const contentType = request.headers.get("content-type") ?? "";
    const raw =
      contentType.includes("application/json")
        ? await request.json()
        : Object.fromEntries((await request.formData()).entries());
    const payload = raw as Record<string, unknown>;
    const input = partsFinderSettingsSchema.parse({
      activationPriceMinor:
        typeof payload.activationPriceMinor === "string"
          ? Math.round(Number.parseFloat(payload.activationPriceMinor) * 100)
          : payload.activationPriceMinor,
      activationDurationDays:
        typeof payload.activationDurationDays === "string"
          ? Number.parseInt(payload.activationDurationDays, 10)
          : payload.activationDurationDays,
      approvalMode: payload.approvalMode,
      featureEnabled:
        payload.featureEnabled === true ||
        payload.featureEnabled === "true" ||
        payload.featureEnabled === "on" ||
        payload.featureEnabled === 1,
      requireManualReviewBelow:
        typeof payload.requireManualReviewBelow === "string"
          ? Number.parseInt(payload.requireManualReviewBelow, 10)
          : payload.requireManualReviewBelow,
    });
    await persistPartsFinderSettings({
      actorId: session.user.id,
      input,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to save settings." },
      { status: 400 },
    );
  }
}
