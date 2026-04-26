import { Suspense } from "react";

import { isAppleAuthConfigured, isGoogleAuthConfigured } from "@/lib/oauth-config";

import { LoginClient } from "./login-client";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const googleEnabled = isGoogleAuthConfigured();
  const appleEnabled = isAppleAuthConfigured();
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-20 text-sm text-muted-foreground">Loading…</div>}>
      <LoginClient googleEnabled={googleEnabled} appleEnabled={appleEnabled} />
    </Suspense>
  );
}
