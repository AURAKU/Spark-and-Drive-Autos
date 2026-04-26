import { processOneQueuedPartsFinderJob } from "@/lib/parts-finder/search-job";
import { monitoringEvent } from "@/lib/monitoring-hooks";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const idleMs = Number(process.env.PARTS_FINDER_WORKER_IDLE_MS ?? 1000);
  const errorBackoffMs = Number(process.env.PARTS_FINDER_WORKER_ERROR_BACKOFF_MS ?? 3000);
  console.log("[parts-finder-worker] started");
  monitoringEvent("parts_finder_worker.started", { idleMs, errorBackoffMs });
  while (true) {
    try {
      const processed = await processOneQueuedPartsFinderJob();
      if (!processed) {
        await sleep(idleMs);
      }
    } catch (error) {
      console.error("[parts-finder-worker] processing error", error);
      monitoringEvent("parts_finder_worker.error", {
        message: error instanceof Error ? error.message : "unknown_error",
      });
      await sleep(errorBackoffMs);
    }
  }
}

run().catch((error) => {
  console.error("[parts-finder-worker] fatal", error);
  process.exit(1);
});
