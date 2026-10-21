/**
 * Node-only startup jobs. Loaded from `instrumentation.ts` only when
 * `NEXT_RUNTIME === "nodejs"` so the Edge compile never sees Prisma / node:crypto.
 */

function scheduleDepositBalanceMaintenance(): void {
  const run = () => {
    void import("./lib/deposit-balance-startup")
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

function scheduleDutyConfigBootstrap(): void {
  const run = () => {
    void import("./lib/duty-intelligence/duty-config-startup.server")
      .then((m) => m.initializeDutyConfiguration())
      .then((result) => {
        if (result.ok) {
          if (result.bootstrapped) {
            console.info("[instrumentation] Ghana duty configuration bootstrapped on startup");
          }
          void import("./lib/duty-intelligence/bog-fx.server")
            .then((m) => m.scheduleBankOfGhanaFxRefresh())
            .catch(() => {});
          return;
        }
        console.warn("[instrumentation] duty-config-startup skipped or failed:", result.reason);
      })
      .catch((e: unknown) => {
        console.error("[instrumentation] duty-config-startup unexpected rejection (bug)", e);
      });
  };

  if (typeof queueMicrotask === "function") {
    queueMicrotask(run);
  } else {
    setTimeout(run, 0);
  }
}

export function startNodeInstrumentation(): void {
  scheduleDepositBalanceMaintenance();
  scheduleDutyConfigBootstrap();
}
