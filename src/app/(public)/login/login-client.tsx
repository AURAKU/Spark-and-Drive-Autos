"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
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

function credentialsMessage(code: string | undefined): string {
  if (!code || code === "CredentialsSignin") {
    return "Invalid email or password. Check your details and try again.";
  }
  if (code === "Configuration") return "Sign-in is not configured correctly. Please contact support.";
  if (code === "AccessDenied") return "Access was denied. Try another sign-in method.";
  if (code === "account-suspended") return "This account has been suspended. Contact support if you believe this is a mistake.";
  return "Could not sign in. Please try again.";
}

/** NextAuth / OAuth can redirect here with ?error=… — surface once for the user. */
function mapQueryError(param: string | null): string | null {
  if (!param) return null;
  switch (param) {
    case "CredentialsSignin":
      return "Invalid email or password. Check your details and try again.";
    case "OAuthAccountNotLinked":
      return "This email is linked to another sign-in method. Use email and password, or the provider you used before.";
    case "Configuration":
      return "Sign-in is not configured correctly. Please contact support.";
    case "AccessDenied":
      return "Access was denied. Try another sign-in method.";
    case "account-suspended":
      return "This account has been suspended. Contact support if you believe this is a mistake.";
    default:
      return "Could not sign in. Please try again.";
  }
}

function OAuthDivider({ label }: { label: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border dark:border-white/10" />
      </div>
      <div className="relative flex justify-center text-[10px] font-medium uppercase tracking-widest">
        <span className="bg-card px-3 text-muted-foreground dark:bg-[oklch(0.16_0.02_250_/_0.98)] dark:text-zinc-500">
          {label}
        </span>
      </div>
    </div>
  );
}

export function LoginClient({
  googleEnabled = false,
  appleEnabled = false,
}: {
  googleEnabled?: boolean;
  appleEnabled?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const afterAuth = getPostAuthRedirectUrl(params.get("callbackUrl"));
  const formId = useId();
  const showedUrlMessage = useRef(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showedUrlMessage.current) return;
    const err = params.get("error");
    const registered = params.get("registered");
    if (registered === "1") {
      showedUrlMessage.current = true;
      toast.success("Account created. Sign in with your email and password.");
      router.replace(`/login?callbackUrl=${encodeURIComponent(afterAuth)}`, { scroll: false });
      return;
    }
    const msg = mapQueryError(err);
    if (msg) {
      showedUrlMessage.current = true;
      toast.error(msg);
      router.replace(`/login?callbackUrl=${encodeURIComponent(afterAuth)}`, { scroll: false });
    }
  }, [params, router, afterAuth]);

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#email") return;
    requestAnimationFrame(() => {
      document.getElementById(`${formId}-login-email`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [formId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = identifier.trim();
    if (!trimmed) {
      toast.error("Enter your email or phone number.");
      return;
    }
    if (!password) {
      toast.error("Enter your password.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        identifier: trimmed,
        password,
        redirect: false,
        callbackUrl: afterAuth,
      });

      if (!res) {
        toast.error("Sign-in did not return a response. Try again.");
        return;
      }

      if (res.error) {
        toast.error(credentialsMessage(res.error));
        return;
      }

      if (res.ok) {
        toast.success("Signed in successfully");
        router.replace(afterAuth);
        router.refresh();
        return;
      }

      toast.error("Could not sign in. Please try again.");
    } catch {
      toast.error("Something went wrong. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const registerHref = `/register?callbackUrl=${encodeURIComponent(afterAuth)}`;

  return (
    <AuthPageShell
      title="Sign in"
      description="Sign in to manage your profile, orders, payments, and saved items. Use Google, Apple, or your registered email and password."
      footer={
        <div className="space-y-3 text-center text-sm">
          <p>
            <Link
              className="font-medium text-foreground underline-offset-4 hover:text-[var(--brand)] hover:underline dark:text-zinc-200 dark:hover:text-[var(--brand)]"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </p>
          <p className="text-muted-foreground dark:text-zinc-500">
            Need help? Use{" "}
            <Link
              className="font-medium text-foreground underline-offset-2 hover:text-[var(--brand)] hover:underline dark:text-zinc-300 dark:hover:text-[var(--brand)]"
              href="/chat"
            >
              Live Support Chat
            </Link>{" "}
            or the contact options in the site footer.
          </p>
        </div>
      }
    >
      {googleEnabled || appleEnabled ? (
        <div className="space-y-3">
          {appleEnabled ? <AppleSignInButton callbackUrl={afterAuth} disabled={loading} /> : null}
          {googleEnabled ? <GoogleSignInButton callbackUrl={afterAuth} disabled={loading} /> : null}
          <OAuthDivider label="Or sign in with email" />
        </div>
      ) : (
        <div className="mb-2">
          <OAuthEnvHint />
        </div>
      )}

      <form
        id={`${formId}-form`}
        onSubmit={onSubmit}
        className={cn("scroll-mt-28 space-y-5", googleEnabled || appleEnabled ? "mt-8" : "mt-2")}
        aria-busy={loading}
        noValidate
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-500">
          Email or phone &amp; password
        </h2>

        <div className="space-y-2">
          <Label htmlFor={`${formId}-login-email`}>Email or phone</Label>
          <Input
            id={`${formId}-login-email`}
            name="identifier"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            disabled={loading}
            className="h-11 min-h-11"
            placeholder="you@example.com or +233…"
          />
        </div>

        <PasswordField
          id={`${formId}-password`}
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
          minLength={8}
          disabled={loading}
        />

        <Button
          type="submit"
          disabled={loading}
          size="lg"
          className="h-11 min-h-11 w-full bg-[var(--brand)] font-semibold text-[#041014] shadow-[0_0_24px_-4px_rgba(20,216,230,0.45)] hover:bg-[var(--brand-deep)] hover:text-white disabled:shadow-none dark:hover:text-white"
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="mt-8 flex flex-col gap-3 border-t border-border pt-8 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground dark:text-zinc-400">New here?</p>
        <Link
          href={registerHref}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-11 min-h-11 w-full justify-center border-border bg-background/80 text-foreground hover:bg-muted sm:w-auto sm:min-w-[11rem]",
            "dark:border-white/20 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/10",
          )}
        >
          Create an account
        </Link>
      </div>
    </AuthPageShell>
  );
}
