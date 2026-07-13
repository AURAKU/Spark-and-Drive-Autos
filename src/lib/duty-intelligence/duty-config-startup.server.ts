import "server-only";

import { checkDutyConfigHealth, initializeGhanaDutyConfig } from "@/lib/duty-intelligence/config-bootstrap.server";

export type RunDutyConfigStartupResult =
  | { ok: true; bootstrapped: boolean; countryConfigId?: string }
  | { ok: false; reason: string };

let startupInFlight: Promise<RunDutyConfigStartupResult> | null = null;

/**
 * Idempotent startup check: ensures Ghana duty configuration exists after deploy.
 * Never throws — safe to schedule from instrumentation on process start.
 */
export async function runDutyConfigStartupSync(): Promise<RunDutyConfigStartupResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, reason: "database_url_missing" };
  }

  try {
    const health = await checkDutyConfigHealth("GH");
    if (health.isReady) {
      return { ok: true, bootstrapped: false };
    }

    if (!health.migrationsApplied) {
      return { ok: false, reason: "migrations_not_applied" };
    }

    console.warn(
      "[duty-config-startup] Ghana duty configuration incomplete — running idempotent seed:",
      health.missing.join(", "),
    );

    const result = await initializeGhanaDutyConfig();
    if (!result.ok) {
      return { ok: false, reason: result.error };
    }

    const after = await checkDutyConfigHealth("GH");
    if (!after.countryConfigExists) {
      return { ok: false, reason: "ghana_config_still_missing_after_seed" };
    }

    return { ok: true, bootstrapped: true, countryConfigId: result.countryConfigId };
  } catch (e) {
    console.error("[duty-config-startup] unexpected failure", e);
    return { ok: false, reason: e instanceof Error ? e.message : "unknown_error" };
  }
}

/** Idempotent entry point for instrumentation — coalesces concurrent calls. */
export async function initializeDutyConfiguration(): Promise<RunDutyConfigStartupResult> {
  if (!startupInFlight) {
    startupInFlight = runDutyConfigStartupSync().finally(() => {
      startupInFlight = null;
    });
  }
  return startupInFlight;
}
