import { Suspense } from "react";

import { isAppleAuthConfigured, isGoogleAuthConfigured } from "@/lib/oauth-config";

import { RegisterClient } from "./register-client";

export default function RegisterPage() {
  const googleEnabled = isGoogleAuthConfigured();
  const appleEnabled = isAppleAuthConfigured();
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-20 text-sm text-muted-foreground">Loading…</div>}>
      <RegisterClient googleEnabled={googleEnabled} appleEnabled={appleEnabled} />
    </Suspense>
  );
}
