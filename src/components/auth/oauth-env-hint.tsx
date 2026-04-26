/** Shown when OAuth env vars are not set — keeps dev expectations clear without breaking the page. */
export function OAuthEnvHint() {
  return (
    <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-center text-[11px] leading-relaxed break-words text-muted-foreground dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-500">
      To enable Google sign-in, add{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        AUTH_GOOGLE_ID
      </code>{" "}
      and{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        AUTH_GOOGLE_SECRET
      </code>{" "}
      in{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground/90 dark:bg-black/40 dark:text-zinc-400">.env</code>.
      Apple Sign-In is off by default; to enable it later, set{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        ENABLE_APPLE_OAUTH=1
      </code>{" "}
      and your Apple credentials. OAuth redirect URIs must match{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        AUTH_URL
      </code>
      .
    </p>
  );
}
