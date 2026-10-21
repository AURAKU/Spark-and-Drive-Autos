/** Public Spark chat closes after this quiet period so transcripts stay private and fresh. */
export const LIVE_SUPPORT_IDLE_MS = 4 * 60 * 1000;

export function isLiveSupportIdleSince(at: string | Date | null | undefined, now = Date.now()): boolean {
  if (!at) return false;
  const t = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (Number.isNaN(t)) return false;
  return now - t >= LIVE_SUPPORT_IDLE_MS;
}
