/**
 * Next.js instrumentation hook — keep DB work off the critical path.
 * Deposit-balance sync is deferred and must never reject or block `register()`.
 */

function scheduleDepositBalanceMaintenance(): void {
  const run = () => {
    void import("@/lib/deposit-balance-startup")
      .then((m) => m.runDepositBalanceMaintenance())
      .then((result) => {
        if (result.ok) return;
        console.warn("[instrumentation] deposit-balance-maintenance skipped or failed:", result.reason, result.code ?? "");
      })
      .catch((e: unknown) => {
        console.error("[instrumentation] deposit-balance-maintenance unexpected rejection (bug)", e);
      });
  };

  if (typeof queueMicrotask === "function") {
    queueMicrotask(run);
  } else {
    setTimeout(run, 0);
  }
}

export async function register() {
  scheduleDepositBalanceMaintenance();

  if (process.env.NODE_ENV !== "production") return;
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be set to at least 32 characters before running in production.",
    );
  }
}
