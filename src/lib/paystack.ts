import { createHmac } from "crypto";

const PAYSTACK_API = "https://api.paystack.co";

export async function paystackInitialize(params: {
  email: string;
  amountMinorUnits: number;
  reference: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
  secretKey?: string;
}) {
  const secret = params.secretKey ?? process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "Paystack secret key is not configured. Add it under Admin → API providers or set PAYSTACK_SECRET_KEY in the environment.",
    );
  }

  const body = {
    email: params.email,
    amount: params.amountMinorUnits,
    reference: params.reference,
    currency: params.currency ?? "GHS",
    metadata: params.metadata ?? {},
    callback_url: params.callbackUrl,
  };

  const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as {
    status: boolean;
    message: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };
  if (!json.status || !json.data) {
    throw new Error(json.message || "Paystack initialize failed");
  }
  return json.data;
}

export async function paystackVerify(reference: string, secretKey?: string) {
  const secret = secretKey ?? process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "Paystack secret key is not configured. Add it under Admin → API providers or set PAYSTACK_SECRET_KEY in the environment.",
    );
  }

  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    next: { revalidate: 0 },
  });

  const json = (await res.json()) as {
    status: boolean;
    message: string;
    data?: {
      status: string;
      amount: number;
      currency: string;
      paid_at: string | null;
      reference: string;
      customer: { email: string };
      metadata: Record<string, unknown> | null;
    };
  };
  if (!json.status || !json.data) {
    throw new Error(json.message || "Paystack verify failed");
  }
  return json.data;
}

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}

export function verifyPaystackSignatureWithSecret(rawBody: string, signature: string | null, secretKey?: string): boolean {
  const secret = secretKey ?? process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}
