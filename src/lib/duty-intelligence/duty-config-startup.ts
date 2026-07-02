import { checkDutyConfigHealth, initializeGhanaDutyConfig } from "@/lib/duty-intelligence/config-bootstrap";

export type RunDutyConfigStartupResult =
  | { ok: true; bootstrapped: boolean; countryConfigId?: string }
  | { ok: false; reason: string };

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
