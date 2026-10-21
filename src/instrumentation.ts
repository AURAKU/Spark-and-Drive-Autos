/**
 * Next.js instrumentation hook — keep DB work off the critical path.
 * Deposit-balance sync is deferred and must never reject or block `register()`.
 *
 * Node-only jobs live in `./instrumentation.node` and are imported only after
 * the `NEXT_RUNTIME === "nodejs"` check. Do not use `webpackIgnore` + `@/…`:
 * that leaves a raw `@/lib` specifier that Node cannot resolve in production.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { startNodeInstrumentation } = await import("./instrumentation.node");
      startNodeInstrumentation();
    } catch (e) {
      console.error("[instrumentation] startup maintenance schedule failed (non-fatal)", e);
    }
  }

  if (process.env.NODE_ENV !== "production") return;
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be set to at least 32 characters before running in production.",
    );
  }
}
