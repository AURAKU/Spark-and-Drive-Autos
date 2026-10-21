/**
 * Limits concurrent media fetches so the hero image/video is not starved by a
 * gallery of thumbs. Slots are granted by priority, then released on load/unmount.
 */

export type MediaLoadPriority = "hero" | "visible" | "adjacent" | "idle";

const PRIORITY_RANK: Record<MediaLoadPriority, number> = {
  hero: 0,
  visible: 1,
  adjacent: 2,
  idle: 3,
};

type Waiter = {
  priority: MediaLoadPriority;
  grant: () => void;
};

const waiters: Waiter[] = [];
let active = 0;

function maxConcurrent(): number {
  if (typeof navigator === "undefined") return 3;
  const conn = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection;
  if (conn?.saveData) return 2;
  const type = conn?.effectiveType;
  if (type === "slow-2g" || type === "2g") return 1;
  if (type === "3g") return 2;
  return 4;
}

function pump() {
  while (active < maxConcurrent() && waiters.length > 0) {
    waiters.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    const next = waiters.shift();
    if (!next) break;
    active += 1;
    next.grant();
  }
}

export function acquireMediaSlot(priority: MediaLoadPriority): {
  ready: Promise<void>;
  release: () => void;
} {
  let released = false;
  let granted = false;
  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const waiter: Waiter = {
    priority,
    grant: () => {
      granted = true;
      resolveReady();
    },
  };

  if (priority === "hero" && active < Math.max(1, maxConcurrent())) {
    active += 1;
    granted = true;
    resolveReady();
  } else {
    waiters.push(waiter);
    pump();
  }

  return {
    ready,
    release: () => {
      if (released) return;
      released = true;
      const queued = waiters.indexOf(waiter);
      if (queued >= 0) waiters.splice(queued, 1);
      if (granted) {
        active = Math.max(0, active - 1);
        pump();
      }
    },
  };
}

export function prefetchMediaUrl(url: string, priority: MediaLoadPriority = "adjacent"): () => void {
  if (!url || typeof window === "undefined") return () => {};
  const slot = acquireMediaSlot(priority);
  let cancelled = false;
  const img = new Image();
  slot.ready.then(() => {
    if (cancelled) {
      slot.release();
      return;
    }
    img.decoding = "async";
    img.onload = () => slot.release();
    img.onerror = () => slot.release();
    img.src = url;
  });
  return () => {
    cancelled = true;
    img.src = "";
    slot.release();
  };
}

export function runWhenBrowserIdle(task: () => void, timeout = 1200): () => void {
  if (typeof window === "undefined") return () => {};
  const ric = window.requestIdleCallback?.bind(window);
  if (ric) {
    const id = ric(() => task(), { timeout });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(task, 280);
  return () => window.clearTimeout(id);
}
