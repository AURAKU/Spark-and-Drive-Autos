import { PaymentProvider } from "@prisma/client";
import { deletePaymentProviderConfig, savePaymentProviderConfig } from "@/actions/payment-providers";
import { PageHeading } from "@/components/typography/page-headings";
import { getPublicAppUrl } from "@/lib/app-url";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { isAppleAuthConfigured, isGoogleAuthConfigured } from "@/lib/oauth-config";
import { isPasswordResetEmailConfigured } from "@/lib/password-reset-email";
import { getPaystackSecrets } from "@/lib/payment-provider-registry";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const field =
  "h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white placeholder:text-zinc-600";

function flag(ok: boolean) {
  return ok ? (
    <span className="text-emerald-400">present</span>
  ) : (
    <span className="text-amber-400/90">missing</span>
  );
}

type ProviderJson = {
  publicKey?: string;
  secretKey?: string;
  secretKeyEnc?: string;
  webhookSecret?: string;
  webhookSecretEnc?: string;
  webhookUrl?: string;
  callbackBaseUrl?: string;
  apiBaseUrl?: string;
  initializeEndpoint?: string;
  verifyEndpoint?: string;
  webhookHeaderName?: string;
  webhookHashAlgorithm?: string;
  integrationNotes?: string;
};

function secretState(json: ProviderJson | null | undefined, kind: "secretKey" | "webhookSecret" | "publicKey") {
  const v =
    kind === "secretKey"
      ? json?.secretKeyEnc?.trim() || json?.secretKey?.trim()
      : kind === "webhookSecret"
        ? json?.webhookSecretEnc?.trim() || json?.webhookSecret?.trim()
        : json?.publicKey?.trim();
  return v ? "configured" : "—";
}

export default async function AdminApiProvidersPage() {
  await requireSuperAdmin();
  const rows = await prisma.paymentProviderConfig.findMany({
    orderBy: [{ isDefault: "desc" }, { provider: "asc" }, { updatedAt: "desc" }],
  });
  const [recentProviderLogs, recentWebhookEvents, latestBackupLog, databaseConnected] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "PaymentProviderConfig" },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.paymentWebhookEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, event: true, reference: true, signatureOk: true, processed: true, createdAt: true },
    }),
    prisma.systemBackupLog.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { completedAt: "desc" },
      select: { type: true, fileName: true, completedAt: true, createdAt: true },
    }),
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
  ]);
  const webhookEndpoint = `${getPublicAppUrl()}/api/webhooks/paystack`;
  const webhookOnLocalhost = webhookEndpoint.includes("localhost") || webhookEndpoint.includes("127.0.0.1");
  const paystack = await getPaystackSecrets();

  const cloudinary = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
  );
  const storageProviderPresent = cloudinary;
  const pusher = Boolean(
    process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER,
  );
  const redis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const appUrl = Boolean(process.env.AUTH_URL ?? process.env.NEXTAUTH_URL);
  const dbUrl = Boolean(process.env.DATABASE_URL);
  const paystackEnv = Boolean(process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_PUBLIC_KEY);
  const serper = Boolean(process.env.SERPER_API_KEY);
  const openAi = Boolean(process.env.OPENAI_API_KEY);
  const anthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const googleOauth = isGoogleAuthConfigured();
  const appleOauth = isAppleAuthConfigured();
  const resendApiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const resetFromEmail = Boolean(process.env.RESET_PASSWORD_FROM_EMAIL?.trim());
  const resetEmailFlow = isPasswordResetEmailConfigured() && appUrl;
  const auth = Boolean(
    (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET) &&
      (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET)!.length >= 32,
  );
  const paystackWebhookEnv = Boolean(process.env.PAYSTACK_WEBHOOK_SECRET || paystack.webhookSecret);
  const readinessChecks = [
    auth,
    appUrl,
    dbUrl,
    Boolean(paystack.secretKey),
    Boolean(paystack.publicKey),
    paystackWebhookEnv,
    cloudinary,
    redis,
  ];
  const readinessScore = Math.round((readinessChecks.filter(Boolean).length / readinessChecks.length) * 100);

  return (
    <div className="space-y-12">
      <div>
        <PageHeading variant="dashboard">API providers</PageHeading>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Configure payment channels (Paystack is the default), verify integration requirements, and review supporting
          service environment variables. Secret values are never shown—only whether they are stored or detected.
        </p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
          <p>
            Payment readiness score: <span className="font-semibold text-white">{readinessScore}%</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Missing critical config is shown in sections below; keep this at 100% for production deployment.
          </p>
        </div>
        <p className="mt-2 text-sm">
          <a href="/admin/settings/receipt-template" className="text-[var(--brand)] hover:underline">
            Manage digital receipt templates →
          </a>
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Paystack — default payment channel</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Standard flow uses the{" "}
          <a
            href="https://paystack.com/docs/api/transaction/#initialize"
            className="text-[var(--brand)] underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Initialize Transaction
          </a>{" "}
          and{" "}
          <a
            href="https://paystack.com/docs/api/transaction/#verify"
            className="text-[var(--brand)] underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Verify Transaction
          </a>{" "}
          APIs. Webhooks use the{" "}
          <a
            href="https://paystack.com/docs/payments/webhooks"
            className="text-[var(--brand)] underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Webhooks guide
          </a>{" "}
          (signature header <code className="rounded bg-white/10 px-1 text-xs">x-paystack-signature</code>, HMAC-SHA512
          of raw body).
        </p>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-zinc-300">
          <li>
            <strong className="text-zinc-200">Secret key</strong> (<code className="text-xs text-zinc-400">sk_test_</code>{" "}
            / <code className="text-xs text-zinc-400">sk_live_</code>): required server-side for initialize, verify, and
            webhook signing. Store in the registry below or <code className="text-xs text-zinc-400">PAYSTACK_SECRET_KEY</code>.
          </li>
          <li>
            <strong className="text-zinc-200">Public key</strong> (<code className="text-xs text-zinc-400">pk_</code>): used
            for Paystack Inline/JS; optional here because checkout uses the hosted <code className="text-xs text-zinc-400">authorization_url</code>.
          </li>
          <li>
            <strong className="text-zinc-200">Callback URL</strong>: set per transaction as <code className="text-xs text-zinc-400">callback_url</code>{" "}
            (car checkout returns to <code className="text-xs text-zinc-400">/checkout/return</code>; wallet top-up to{" "}
            <code className="text-xs text-zinc-400">/dashboard/profile</code>). Override the public origin with{" "}
            <em>Callback base URL</em> on a Paystack row when needed.
          </li>
          <li>
            <strong className="text-zinc-200">Webhook URL</strong> (register in Paystack Dashboard): must match your
            deployed public origin.
          </li>
        </ul>
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Webhook endpoint (copy into Paystack)</p>
          <code className="mt-2 block break-all text-sm text-emerald-300/90">{webhookEndpoint}</code>
          <p className="mt-2 text-xs text-zinc-500">
            App URL is derived from <code className="rounded bg-white/5 px-1">AUTH_URL</code> /{" "}
            <code className="rounded bg-white/5 px-1">NEXTAUTH_URL</code> (see{" "}
            <code className="rounded bg-white/5 px-1">src/lib/app-url.ts</code>). Production must use HTTPS.
          </p>
          {webhookOnLocalhost ? (
            <p className="mt-2 text-xs text-amber-300">
              Warning: webhook URL resolves to localhost. Configure public app URL before production.
            </p>
          ) : null}
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-4 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <dt className="text-zinc-400">Effective secret key</dt>
            <dd>{flag(Boolean(paystack.secretKey))}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <dt className="text-zinc-400">Effective public key</dt>
            <dd>{flag(Boolean(paystack.publicKey))}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <dt className="text-zinc-400">Webhook signing secret</dt>
            <dd>{flag(paystackWebhookEnv)}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <dt className="text-zinc-400">Signature header / hash</dt>
            <dd className="text-xs text-zinc-300">
              {(paystack.webhookHeaderName || "x-paystack-signature")} / {(paystack.webhookHashAlgorithm || "HMAC-SHA512")}
            </dd>
          </div>
        </dl>
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-zinc-400">
          <p className="font-semibold text-zinc-300">Callback URL management</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Base callback origin: {paystack.callbackBaseUrl || "(fallback to AUTH_URL/NEXTAUTH_URL)"}</li>
            <li>Vehicle checkout: <code>/checkout/return</code></li>
            <li>Wallet top-up: <code>/dashboard/wallet</code> / <code>/dashboard/profile</code></li>
            <li>Parts Finder activation: <code>/dashboard/parts-finder</code></li>
            <li>Sourcing deposit: <code>/dashboard/sourcing</code></li>
            <li>Orders: <code>/dashboard/orders</code></li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Payment provider registry</h2>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Add, edit, or remove provider profiles. The <strong className="text-zinc-300">default</strong> enabled row
          drives wallet top-up and vehicle checkout. Leave secret fields blank when editing to keep existing values.
          Paystack remains the platform default when no row is marked default. You can also store custom API routing
          requirements per provider so your team can switch integrations quickly.
        </p>

        <form action={savePaymentProviderConfig} className="mt-6 grid max-w-4xl gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2">
          <p className="text-sm font-medium text-zinc-300 sm:col-span-2">Add provider</p>
          <select name="provider" className={field} required>
            {Object.values(PaymentProvider).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select name="providerType" className={field} required defaultValue="PAYSTACK">
            {["PAYSTACK", "MANUAL_BANK", "MOBILE_MONEY_MANUAL", "OFFICE_CASH", "ALIPAY_MANUAL", "OTHER"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input name="label" required placeholder="Label (e.g. Primary Paystack)" className={field} />
          <input name="publicKey" placeholder="Public key (optional)" className={field} />
          <input name="secretKey" type="password" autoComplete="new-password" placeholder="Secret key" className={field} />
          <input
            name="webhookSecret"
            type="password"
            autoComplete="new-password"
            placeholder="Webhook signing secret (optional; defaults to secret key)"
            className={field}
          />
          <input name="webhookUrl" placeholder="Webhook URL note (optional, for your records)" className={field} />
          <input name="apiBaseUrl" placeholder="Provider API base URL (optional)" className={field} />
          <input name="initializeEndpoint" placeholder="Initialize endpoint (optional)" className={field} />
          <input name="verifyEndpoint" placeholder="Verify endpoint (optional)" className={field} />
          <input name="webhookHeaderName" placeholder="Webhook signature header (optional)" className={field} />
          <input name="webhookHashAlgorithm" placeholder="Webhook hash algorithm (optional)" className={field} />
          <input
            name="callbackBaseUrl"
            placeholder="Callback base URL (optional, e.g. https://app.example.com)"
            className={`${field} sm:col-span-2`}
          />
          <textarea
            name="integrationNotes"
            placeholder="Integration notes / requirements (optional)"
            className="min-h-24 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 sm:col-span-2"
          />
          <input
            name="supportedCurrencies"
            placeholder="Supported currencies CSV (e.g. GHS,USD,RMB)"
            className={`${field} sm:col-span-2`}
          />
          <input
            name="supportedPaymentTypes"
            placeholder="Supported payment types CSV (e.g. FULL,RESERVATION_DEPOSIT)"
            className={`${field} sm:col-span-2`}
          />
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="enabled" defaultChecked />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="isDefault" defaultChecked />
            Set as default channel
          </label>
          <button
            type="submit"
            className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black sm:col-span-2 sm:w-fit"
          >
            Save provider
          </button>
        </form>

        <div className="mt-8 space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No rows yet. Add Paystack above or run database seed.</p>
          ) : (
            rows.map((r) => {
              const j = (r.configJson ?? {}) as ProviderJson;
              return (
                <details
                  key={r.id}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] open:border-[var(--brand)]/30"
                >
                  <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="font-medium text-white">{r.label}</span>
                        <span className="ml-2 text-sm text-zinc-500">{r.provider} · {r.providerType}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {r.enabled ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">enabled</span>
                        ) : (
                          <span className="rounded-full bg-zinc-500/20 px-2 py-0.5 text-zinc-400">disabled</span>
                        )}
                        {r.isDefault ? (
                          <span className="rounded-full bg-[var(--brand)]/20 px-2 py-0.5 text-[var(--brand)]">default</span>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      Keys: secret {secretState(j, "secretKey")} · public {secretState(j, "publicKey")} · webhook secret{" "}
                      {secretState(j, "webhookSecret")}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      API: {j.apiBaseUrl?.trim() || "—"} · init {j.initializeEndpoint?.trim() || "—"} · verify{" "}
                      {j.verifyEndpoint?.trim() || "—"}
                    </p>
                  </summary>
                  <div className="border-t border-white/10 px-4 py-4">
                    <form action={savePaymentProviderConfig} className="grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="id" value={r.id} />
                      <select name="provider" className={field} required defaultValue={r.provider}>
                        {Object.values(PaymentProvider).map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <select name="providerType" className={field} required defaultValue={r.providerType}>
                        {["PAYSTACK", "MANUAL_BANK", "MOBILE_MONEY_MANUAL", "OFFICE_CASH", "ALIPAY_MANUAL", "OTHER"].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input name="label" required defaultValue={r.label} className={field} />
                      <input name="publicKey" placeholder="Public key (blank = keep)" className={field} />
                      <input
                        name="secretKey"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Secret key (blank = keep)"
                        className={field}
                      />
                      <input
                        name="webhookSecret"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Webhook secret (blank = keep)"
                        className={field}
                      />
                      <input
                        name="webhookUrl"
                        placeholder="Webhook URL note (blank = keep)"
                        defaultValue={j.webhookUrl ?? ""}
                        className={field}
                      />
                      <input
                        name="apiBaseUrl"
                        placeholder="API base URL (blank = keep)"
                        defaultValue={j.apiBaseUrl ?? ""}
                        className={field}
                      />
                      <input
                        name="initializeEndpoint"
                        placeholder="Initialize endpoint (blank = keep)"
                        defaultValue={j.initializeEndpoint ?? ""}
                        className={field}
                      />
                      <input
                        name="verifyEndpoint"
                        placeholder="Verify endpoint (blank = keep)"
                        defaultValue={j.verifyEndpoint ?? ""}
                        className={field}
                      />
                      <input
                        name="webhookHeaderName"
                        placeholder="Webhook signature header (blank = keep)"
                        defaultValue={j.webhookHeaderName ?? ""}
                        className={field}
                      />
                      <input
                        name="webhookHashAlgorithm"
                        placeholder="Webhook hash algorithm (blank = keep)"
                        defaultValue={j.webhookHashAlgorithm ?? ""}
                        className={field}
                      />
                      <input
                        name="callbackBaseUrl"
                        placeholder="Callback base URL (blank = keep)"
                        defaultValue={j.callbackBaseUrl ?? ""}
                        className={`${field} sm:col-span-2`}
                      />
                      <textarea
                        name="integrationNotes"
                        placeholder="Integration notes (blank = keep)"
                        defaultValue={j.integrationNotes ?? ""}
                        className="min-h-24 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600 sm:col-span-2"
                      />
                      <input
                        name="supportedCurrencies"
                        placeholder="Supported currencies CSV"
                        defaultValue={r.supportedCurrencies.join(",")}
                        className={`${field} sm:col-span-2`}
                      />
                      <input
                        name="supportedPaymentTypes"
                        placeholder="Supported payment types CSV"
                        defaultValue={r.supportedPaymentTypes.join(",")}
                        className={`${field} sm:col-span-2`}
                      />
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input type="checkbox" name="enabled" defaultChecked={r.enabled} />
                        Enabled
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input type="checkbox" name="isDefault" defaultChecked={r.isDefault} />
                        Default channel
                      </label>
                      <button
                        type="submit"
                        className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black sm:col-span-2 sm:w-fit"
                      >
                        Update provider
                      </button>
                    </form>
                    <form action={deletePaymentProviderConfig} className="mt-4 border-t border-white/10 pt-4">
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="text-sm text-red-400 hover:text-red-300">
                        Delete provider
                      </button>
                    </form>
                  </div>
                </details>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Infrastructure environment</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Deployment variables (not stored in the database). Presence only—values are never displayed.
        </p>
        <dl className="mt-6 max-w-xl space-y-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">AUTH_SECRET / NEXTAUTH_SECRET (32+ chars)</dt>
            <dd>{flag(auth)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Cloudinary</dt>
            <dd>{flag(cloudinary)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Pusher (realtime chat)</dt>
            <dd>{flag(pusher)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Upstash Redis (rate limits)</dt>
            <dd>{flag(redis)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">AUTH_URL / NEXTAUTH_URL (public app URL)</dt>
            <dd>{flag(appUrl)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">DATABASE_URL</dt>
            <dd>{flag(dbUrl)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">PAYSTACK_* env fallback</dt>
            <dd>{flag(paystackEnv)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">PAYSTACK_WEBHOOK_SECRET</dt>
            <dd>{flag(Boolean(process.env.PAYSTACK_WEBHOOK_SECRET))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">SERPER_API_KEY (Parts Finder web discovery)</dt>
            <dd>{flag(serper)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">OPENAI_API_KEY (AI summaries)</dt>
            <dd>{flag(openAi)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">ANTHROPIC_API_KEY (AI summaries, optional)</dt>
            <dd>{flag(anthropic)}</dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-zinc-500">
          Copy <code className="rounded bg-white/5 px-1">.env.example</code> to <code className="rounded bg-white/5 px-1">.env</code>{" "}
          and fill keys for local or hosted environments.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Authentication & account recovery</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Login options and password reset readiness. Secret values stay hidden; only presence/config status is shown.
        </p>
        <dl className="mt-6 max-w-2xl space-y-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Google OAuth (AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET)</dt>
            <dd>{flag(googleOauth)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">
              Apple OAuth (optional — off by default; set <code className="rounded bg-white/5 px-1">ENABLE_APPLE_OAUTH=1</code> + Apple
              credentials)
            </dt>
            <dd>{flag(appleOauth)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">RESEND_API_KEY (password reset email transport)</dt>
            <dd>{flag(resendApiKey)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">RESET_PASSWORD_FROM_EMAIL</dt>
            <dd>{flag(resetFromEmail)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Password reset delivery readiness</dt>
            <dd>{flag(Boolean(resetEmailFlow))}</dd>
          </div>
        </dl>
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-zinc-400">
          <p>
            To enable Google sign-in, add <code className="rounded bg-white/5 px-1">AUTH_GOOGLE_ID</code> +{" "}
            <code className="rounded bg-white/5 px-1">AUTH_GOOGLE_SECRET</code> in{" "}
            <code className="rounded bg-white/5 px-1">.env</code>. Apple Sign-In is disabled by default; to opt in, set{" "}
            <code className="rounded bg-white/5 px-1">ENABLE_APPLE_OAUTH=1</code> and configure{" "}
            <code className="rounded bg-white/5 px-1">AUTH_APPLE_ID</code> with either{" "}
            <code className="rounded bg-white/5 px-1">AUTH_APPLE_SECRET</code> (JWT) or{" "}
            <code className="rounded bg-white/5 px-1">APPLE_TEAM_ID</code>, <code className="rounded bg-white/5 px-1">APPLE_KEY_ID</code>,{" "}
            <code className="rounded bg-white/5 px-1">APPLE_PRIVATE_KEY</code>. OAuth redirect URIs must match{" "}
            <code className="rounded bg-white/5 px-1">AUTH_URL</code>.
          </p>
          <p className="mt-2">
            Forgot-password emails in production require <code className="rounded bg-white/5 px-1">RESEND_API_KEY</code> and{" "}
            <code className="rounded bg-white/5 px-1">RESET_PASSWORD_FROM_EMAIL</code>. Reset links use{" "}
            <code className="rounded bg-white/5 px-1">AUTH_URL</code>/<code className="rounded bg-white/5 px-1">NEXTAUTH_URL</code>.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Backend API integration checklist</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Use this as your operational checklist when connecting or auditing backend integrations from the admin panel.
          Registry-backed fields can be edited above; env-only fields are deployment-managed.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Integration</th>
                <th className="px-3 py-2 font-medium">Required fields</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Current status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-zinc-300">
              <tr>
                <td className="px-3 py-2">Paystack Checkout + Verify</td>
                <td className="px-3 py-2">Public key, Secret key, Callback base URL</td>
                <td className="px-3 py-2">Provider registry row (or PAYSTACK_* env fallback)</td>
                <td className="px-3 py-2">{flag(Boolean(paystack.secretKey && paystack.publicKey))}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Paystack Webhook</td>
                <td className="px-3 py-2">Webhook URL, Webhook secret, Header name, Hash algorithm</td>
                <td className="px-3 py-2">Provider registry row + Paystack dashboard</td>
                <td className="px-3 py-2">{flag(Boolean(paystack.webhookSecret))}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Parts Finder external discovery</td>
                <td className="px-3 py-2">SERPER_API_KEY</td>
                <td className="px-3 py-2">Environment</td>
                <td className="px-3 py-2">{flag(serper)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">Realtime chat notifications</td>
                <td className="px-3 py-2">PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER</td>
                <td className="px-3 py-2">Environment</td>
                <td className="px-3 py-2">{flag(pusher)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Webhook URL to register in Paystack:{" "}
          <code className="rounded bg-white/5 px-1 text-emerald-300/90">{webhookEndpoint}</code>
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Admin test & verification tools</h2>
        <p className="mt-2 text-sm text-zinc-400">Safe tools for config checks (no real charges triggered).</p>
        <div className="mt-3 space-y-2 text-sm">
          <a className="text-[var(--brand)] hover:underline" href="/api/admin/providers/paystack/readiness" target="_blank" rel="noreferrer">
            Paystack readiness JSON →
          </a>
          <a className="block text-[var(--brand)] hover:underline" href="/admin/health">
            System health dashboard →
          </a>
          <a className="block text-[var(--brand)] hover:underline" href="/api/admin/health/readiness" target="_blank" rel="noreferrer">
            Full deployment readiness health JSON →
          </a>
          <p className="text-xs text-zinc-500">
            Verify reference endpoint: <code>/api/admin/providers/paystack/verify-reference</code> (POST with JSON: {"{ reference }"}).
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Backup readiness</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Operational checks for backup safety before deployment and rollback operations.
        </p>
        <dl className="mt-4 max-w-3xl space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Last successful backup</dt>
            <dd className="text-zinc-200">
              {latestBackupLog?.completedAt
                ? `${latestBackupLog.completedAt.toISOString().slice(0, 16).replace("T", " ")} · ${
                    latestBackupLog.fileName ?? "file name not recorded"
                  }`
                : "No successful backup metadata yet"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Database connected</dt>
            <dd>{flag(Boolean(databaseConnected))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-400">Storage provider present (Cloudinary)</dt>
            <dd>{flag(storageProviderPresent)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-500">
          Backup metadata source: <code className="rounded bg-white/5 px-1">SystemBackupLog</code>. Record successful
          backup runs so this panel stays current.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold text-white">Recent provider integration logs</h2>
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            {recentProviderLogs.map((log) => (
              <li key={log.id}>
                {log.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {log.action}
              </li>
            ))}
            {recentProviderLogs.length === 0 ? <li>No provider logs yet.</li> : null}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold text-white">Recent webhook events</h2>
          <ul className="mt-3 space-y-2 text-xs text-zinc-400">
            {recentWebhookEvents.map((event) => (
              <li key={event.id}>
                {event.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {event.event} ·{" "}
                {event.reference ?? "no-ref"} · sig {event.signatureOk ? "ok" : "bad"} ·{" "}
                {event.processed ? "processed" : "pending"}
              </li>
            ))}
            {recentWebhookEvents.length === 0 ? <li>No webhook events yet.</li> : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
