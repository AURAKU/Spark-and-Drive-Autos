export function monitoringEvent(
  event: string,
  metadata?: Record<string, unknown>,
) {
  const payload = {
    event,
    at: new Date().toISOString(),
    ...(metadata ? { metadata } : {}),
  };
  console.log("[monitoring]", JSON.stringify(payload));
}
