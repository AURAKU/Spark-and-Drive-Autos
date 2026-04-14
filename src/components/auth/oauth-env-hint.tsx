/** Shown when OAuth env vars are not set — keeps dev expectations clear without breaking the page. */
export function OAuthEnvHint() {
  return (
    <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-center text-[11px] leading-relaxed text-muted-foreground dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-500">
      To enable Google or Apple sign-in, add credentials in{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        .env
      </code>
      :{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        AUTH_GOOGLE_ID
      </code>{" "}
      +{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        AUTH_GOOGLE_SECRET
      </code>
      , and/or Apple (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        AUTH_APPLE_ID
      </code>{" "}
      with either{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        AUTH_APPLE_SECRET
      </code>{" "}
      JWT or{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        APPLE_TEAM_ID
      </code>
      ,{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        APPLE_KEY_ID
      </code>
      ,{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        APPLE_PRIVATE_KEY
      </code>
      ). Redirect URIs must match{" "}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground/90 dark:bg-black/40 dark:text-zinc-400">
        AUTH_URL
      </code>
      .
    </p>
  );
}
