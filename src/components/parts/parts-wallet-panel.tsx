"use client";

import { WalletTopupFlow } from "@/components/parts/wallet-topup-flow";

type Props = {
  walletBalance: number;
  isSignedIn: boolean;
};

/**
 * Storefront wallet strip on parts listing / detail — uses shared top-up flow.
 */
const PARTS_WALLET_COPY =
  "Your storefront wallet holds Ghana cedis for Parts and Accessories on this site. Top-ups run through secured payment channel — mobile money, bank transfer where your provider supports it. When payment is authorised, your balance updates at once so you can move straight to cart or buy now checkout.";

export function PartsWalletPanel({ walletBalance, isSignedIn }: Props) {
  return (
    <WalletTopupFlow
      walletBalance={walletBalance}
      isSignedIn={isSignedIn}
      variant="card"
      defaultAmount={50}
      heading="Parts wallet"
      supportingText={PARTS_WALLET_COPY}
      signInHref="/login?callbackUrl=%2Fparts"
    />
  );
}
