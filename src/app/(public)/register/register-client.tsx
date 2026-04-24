"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { AppleSignInButton } from "@/components/auth/apple-sign-in-button";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { OAuthEnvHint } from "@/components/auth/oauth-env-hint";
import { PasswordField } from "@/components/auth/password-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPostAuthRedirectUrl } from "@/lib/post-auth-redirect";
import { cn } from "@/lib/utils";

type RegisterErrorBody = {
  error?: string;
  issues?: { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] };
};

function firstIssueMessage(body: RegisterErrorBody): string | null {
  const fe = body.issues?.fieldErrors;
  if (fe) {
    for (const key of Object.keys(fe)) {
      const msgs = fe[key];
      if (msgs?.[0]) return msgs[0];
    }
  }
  const formErr = body.issues?.formErrors?.[0];
  if (formErr) return formErr;
  return null;
}

async function parseRegisterResponse(res: Response): Promise<RegisterErrorBody> {
  const text = await res.text();
  if (!text.trim()) return { error: `Request failed (${res.status})` };
  try {
    return JSON.parse(text) as RegisterErrorBody;
  } catch {
    return { error: text.slice(0, 200) || `Request failed (${res.status})` };
  }
}

const simpleEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterClient({
  googleEnabled = false,
  appleEnabled = false,
}: {
  googleEnabled?: boolean;
  appleEnabled?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const afterAuth = getPostAuthRedirectUrl(searchParams.get("callbackUrl"));
  const formId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
    if (id !== "phone" && id !== "email") return;
    requestAnimationFrame(() => {
      const el =
        id === "email"
          ? document.getElementById(`${formId}-reg-email`)
          : document.getElementById(`${formId}-phone-input`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [formId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      toast.error("Enter your full name (at least 2 characters).");
      return;
    }
    if (!trimmedEmail || !simpleEmail.test(trimmedEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        }),
      });

      const data = await parseRegisterResponse(res);

      if (!res.ok) {
        const detail = firstIssueMessage(data) ?? data.error ?? "Registration failed";
        toast.error(detail);
        return;
      }

      const signInRes = await signIn("credentials", {
        identifier: trimmedEmail,
        password,
        redirect: false,
        callbackUrl: afterAuth,
        redirectTo: afterAuth,
      });

      if (signInRes?.error) {
        toast.success("Account created. Sign in with your new password.");
        router.replace(`/login?callbackUrl=${encodeURIComponent(afterAuth)}&registered=1`);
        router.refresh();
        return;
      }

      if (signInRes?.ok) {
        toast.success("Welcome to Spark and Drive Autos");
        router.replace(afterAuth);
        router.refresh();
        return;
      }

      toast.success("Account created", { description: "Sign in on the next screen." });
      router.replace(`/login?callbackUrl=${encodeURIComponent(afterAuth)}&registered=1`);
      router.refresh();
    } catch {
      toast.error("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const loginHref = `/login?callbackUrl=${encodeURIComponent(afterAuth)}`;
  const oauthAvailable = googleEnabled || appleEnabled;
  const registerDescription = oauthAvailable
    ? "Register to track orders, save favorites, message our team, and check out faster. You can create an account with Google, Apple, or email."
    : "Register to track orders, save favorites, message our team, and check out faster using your email and a password.";

  return (
    <AuthPageShell
      title="Create account"
      description={registerDescription}
      footer={
        <p className="text-center text-sm text-muted-foreground dark:text-zinc-500">
          <Link
            className="font-medium text-foreground underline-offset-4 hover:text-[var(--brand)] hover:underline dark:text-zinc-300"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </p>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground dark:text-zinc-400">Already have an account?</p>
        <Link
          href={loginHref}
          aria-busy={loading}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-11 min-h-11 w-full justify-center border-border bg-background/80 text-foreground hover:bg-muted sm:w-auto sm:min-w-[11rem]",
            "dark:border-white/20 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/10",
            loading && "pointer-events-none opacity-60",
          )}
        >
          Sign in
        </Link>
      </div>

      {oauthAvailable ? (
        <div className="mt-8 space-y-4">
          {appleEnabled ? <AppleSignInButton callbackUrl={afterAuth} disabled={loading} /> : null}
          {googleEnabled ? <GoogleSignInButton callbackUrl={afterAuth} disabled={loading} /> : null}
          <p className="text-center text-xs text-muted-foreground dark:text-zinc-500">
            OAuth uses your provider email—we match an existing account or create one for you.
          </p>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] font-medium uppercase tracking-widest">
              <span className="bg-card px-3 text-muted-foreground dark:bg-[oklch(0.16_0.02_250_/_0.98)] dark:text-zinc-500">
                Or register with email
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <OAuthEnvHint />
        </div>
      )}

      <form
        id={`${formId}-form`}
        onSubmit={onSubmit}
        className="scroll-mt-28 mt-8 space-y-5"
        aria-busy={loading}
        noValidate
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
          Your account
        </h2>

        <div className="space-y-2">
          <Label htmlFor={`${formId}-name`}>Full name</Label>
          <Input
            id={`${formId}-name`}
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            disabled={loading}
            className="h-11 min-h-11"
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-reg-email`}>Email</Label>
          <Input
            id={`${formId}-reg-email`}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="h-11 min-h-11"
            placeholder="you@example.com"
          />
        </div>
        <PasswordField
          id={`${formId}-password`}
          label="Password"
          labelHint="8+ characters"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          required
          minLength={8}
          disabled={loading}
        />

        <div
          id={`${formId}-phone-block`}
          className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
            Phone (optional)
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground dark:text-zinc-500">
            For SMS updates and faster support. You can add this later in your profile too.
          </p>
          <div className="space-y-2 pt-1">
            <Label htmlFor={`${formId}-phone-input`}>Mobile number</Label>
            <Input
              id={`${formId}-phone-input`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+233 …"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              className="h-11 min-h-11"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="h-11 min-h-11 w-full bg-[var(--brand)] font-semibold text-[#041014] shadow-[0_0_24px_-4px_rgba(20,216,230,0.45)] hover:bg-[var(--brand-deep)] hover:text-white disabled:shadow-none dark:hover:text-white"
        >
          {loading ? "Creating your account…" : "Create account"}
        </Button>

        <p className="text-center text-xs text-muted-foreground dark:text-zinc-500">
          By creating an account you agree to our{" "}
          <Link className="text-[var(--brand)] underline-offset-2 hover:underline" href="/terms">
            Terms
          </Link>{" "}
          and{" "}
          <Link className="text-[var(--brand)] underline-offset-2 hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthPageShell>
  );
}
