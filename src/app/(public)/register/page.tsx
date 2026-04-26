import { Suspense } from "react";

import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { isAppleAuthConfigured, isGoogleAuthConfigured } from "@/lib/oauth-config";
import { prisma } from "@/lib/prisma";

import { RegisterClient } from "./register-client";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const googleEnabled = isGoogleAuthConfigured();
  const appleEnabled = isAppleAuthConfigured();
  const platformTerms = await prisma.policyVersion.findFirst({
    where: { policyKey: POLICY_KEYS.PLATFORM_TERMS_PRIVACY, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    select: { version: true },
  });
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-20 text-sm text-muted-foreground">Loading…</div>}>
      <RegisterClient
        googleEnabled={googleEnabled}
        appleEnabled={appleEnabled}
        platformTermsRequired={Boolean(platformTerms)}
        platformTermsVersion={platformTerms?.version ?? null}
      />
    </Suspense>
  );
}
