"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeading } from "@/components/typography/page-headings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ForgotRes = { ok?: boolean; message?: string; devResetUrl?: string; error?: string };

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setDevUrl(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = (await res.json()) as ForgotRes;
      if (!res.ok) throw new Error(data.error ?? "Failed to start password reset");
      toast.success("If an account exists, reset instructions have been sent.");
      if (data.devResetUrl) setDevUrl(data.devResetUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start reset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <PageHeading variant="auth">Forgot password</PageHeading>
      <p className="mt-3 text-sm text-zinc-400">Enter your email address and we&apos;ll send reset instructions.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="identifier">Email address</Label>
          <Input
            id="identifier"
            type="email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="mt-1"
            placeholder="you@example.com"
            required
          />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset instructions"}
        </Button>
      </form>
      {devUrl ? (
        <p className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
          Dev mode reset link:{" "}
          <Link href={devUrl} className="underline underline-offset-2">
            {devUrl}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
