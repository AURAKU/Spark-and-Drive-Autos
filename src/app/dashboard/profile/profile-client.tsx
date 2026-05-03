"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { WalletTopupFlow } from "@/components/parts/wallet-topup-flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AddressRow = {
  id: string;
  fullName: string;
  phone: string;
  region: string;
  city: string;
  district: string | null;
  locality: string | null;
  digitalAddress: string | null;
  streetAddress: string;
  landmark: string | null;
  notes: string | null;
  isDefault: boolean;
};

type LegalStatusRow = {
  kind: "policy" | "contract";
  id: string;
  key: string;
  title: string;
  version: string;
  effectiveAt: Date;
  accepted: boolean;
};

const PUBLIC_LEGAL_LINKS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/reservation-policy", label: "Reservation Policy" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/payment-dispute-policy", label: "Payment Dispute Policy" },
  { href: "/sourcing-policy", label: "Sourcing Policy" },
  { href: "/legal/sourcing-agreement", label: "Car purchase / sourcing agreement" },
  { href: "/legal/parts-finder", label: "Parts Finder & storefront legal" },
] as const;

export function ProfileClient({
  userId,
  email,
  name,
  phone,
  walletBalance,
  addresses,
  legalRows,
  legalFocus = false,
}: {
  userId: string | null;
  email: string | null | undefined;
  name: string | null | undefined;
  phone: string | null | undefined;
  walletBalance: number;
  addresses: AddressRow[];
  legalRows: LegalStatusRow[];
  legalFocus?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const walletRef = params.get("walletRef");

  const [loading, setLoading] = useState(false);
  const [accountName, setAccountName] = useState(name ?? "");
  const [address, setAddress] = useState({
    fullName: name ?? "",
    phone: "",
    region: "Greater Accra",
    city: "Accra",
    district: "",
    locality: "",
    digitalAddress: "",
    streetAddress: "",
    landmark: "",
    notes: "",
    isDefault: addresses.length === 0,
  });
  const pendingLegalCount = legalRows.filter((r) => !r.accepted).length;
  const [legalConfirm, setLegalConfirm] = useState(false);

  useEffect(() => {
    if (!legalFocus) return;
    const t = window.setTimeout(() => {
      document.getElementById("legal-requirements")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [legalFocus]);

  useEffect(() => {
    if (!walletRef) return;
    let done = false;
    async function verifyTopup() {
      const res = await fetch("/api/wallet/topup/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: walletRef }),
      });
      const data = await res.json().catch(() => ({}));
      if (done) return;
      if (res.ok && data.status === "SUCCESS") {
        toast.success("Wallet top-up confirmed.");
        router.replace("/dashboard/profile");
        router.refresh();
      }
    }
    void verifyTopup();
    return () => {
      done = true;
    };
  }, [walletRef, router]);

  async function submitAddress(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/profile/address", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(address),
      });
      if (!res.ok) throw new Error("Could not save address");
      toast.success("Address saved");
      setAddress((a) => ({ ...a, district: "", locality: "", digitalAddress: "", streetAddress: "", landmark: "", notes: "" }));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setLoading(false);
    }
  }

  async function updateName(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/profile/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: accountName }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not update name.");
      toast.success("Name updated.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update name.");
    } finally {
      setLoading(false);
    }
  }

  async function setDefaultAddress(id: string) {
    try {
      const res = await fetch("/api/profile/address", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, isDefault: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not set default address.");
      }
      toast.success("Default address updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set default address.");
    }
  }

  async function deleteAddress(id: string) {
    try {
      const res = await fetch(`/api/profile/address?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not remove address.");
      }
      toast.success("Address removed.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove address.");
    }
  }

  async function acceptAllLegal() {
    if (pendingLegalCount > 0 && !legalConfirm) {
      toast.error('Confirm that you have read the policies and check "I accept all legal requirements" first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/legal/profile/accept-all", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; acceptedPolicies?: number; acceptedContracts?: number };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not save legal acceptance.");
      }
      const acceptedPolicies = Number(data.acceptedPolicies ?? 0);
      const acceptedContracts = Number(data.acceptedContracts ?? 0);
      setLegalConfirm(false);
      toast.success(
        acceptedPolicies + acceptedContracts > 0
          ? `Accepted ${acceptedPolicies} policy update(s) and ${acceptedContracts} contract update(s).`
          : "All legal requirements are already accepted.",
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save legal acceptance.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-300">
        <h2 className="text-lg font-semibold text-white">Account</h2>
        <p className="mt-2"><span className="text-zinc-500">User ID:</span> <span className="font-mono text-xs">{userId ?? "—"}</span></p>
        <form className="mt-3 flex flex-col gap-2 sm:max-w-md" onSubmit={(e) => void updateName(e)}>
          <Label htmlFor="account-name">Username</Label>
          <Input
            id="account-name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            minLength={2}
            maxLength={120}
            required
          />
          <div className="pt-1">
            <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Update username"}</Button>
          </div>
        </form>
        <p className="mt-3"><span className="text-zinc-500">Phone:</span> {phone ?? "—"}</p>
        <p className="mt-1"><span className="text-zinc-500">Email:</span> {email ?? "—"}</p>
        <p className="mt-1 text-xs text-zinc-500">Email and phone are fixed to this account and cannot be changed here.</p>
      </div>

      <div id="legal-requirements" className="scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Legal requirements</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Review the documents below, then accept once here. Vehicle checkout, reservation deposits, online and offline
          payments, and other protected flows stay unlocked until administrators publish new versions (shown as pending).
        </p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Reference documents</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-[var(--brand)]">
            {PUBLIC_LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:underline" target="_blank" rel="noreferrer">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pendingLegalCount === 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
            {pendingLegalCount === 0 ? "All legal requirements accepted" : `${pendingLegalCount} pending update${pendingLegalCount > 1 ? "s" : ""}`}
          </span>
        </div>
        {pendingLegalCount > 0 ? (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={legalConfirm}
              onChange={(e) => setLegalConfirm(e.target.checked)}
              className="mt-1 size-4 shrink-0 rounded border-white/20 accent-[var(--brand)]"
            />
            <span>I have read the applicable policies and contracts and accept all legal requirements for my account.</span>
          </label>
        ) : null}
        <div className="mt-4">
          <Button
            type="button"
            onClick={() => void acceptAllLegal()}
            disabled={loading || pendingLegalCount === 0 || !legalConfirm}
          >
            {loading ? "Saving..." : "Save legal acceptance"}
          </Button>
          {pendingLegalCount === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">You are up to date. New admin-published versions will appear here.</p>
          ) : !legalConfirm ? (
            <p className="mt-2 text-xs text-zinc-500">Confirm the checkbox above to enable saving.</p>
          ) : null}
        </div>
        <div className="mt-4 space-y-2">
          {legalRows.map((row) => (
            <div key={`${row.kind}-${row.id}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-zinc-100">{row.title}</p>
                <span className={`rounded-md px-2 py-0.5 text-xs ${row.accepted ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"}`}>
                  {row.accepted ? "Accepted" : "Pending"}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {row.kind === "contract" ? "Contract" : "Policy"} · {row.key} · Version {row.version} · Effective{" "}
                {new Date(row.effectiveAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      <WalletTopupFlow
        walletBalance={walletBalance}
        isSignedIn
        variant="card"
        defaultAmount={100}
        heading="Storefront wallet"
        supportingText="This balance is for parts and accessories checkout on the storefront. Add funds via Paystack (mobile money). Authorised payments credit your wallet immediately so you can complete purchases."
        signInHref="/login?callbackUrl=%2Fdashboard%2Fprofile"
      />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold text-white">Delivery addresses (Ghana)</h2>
        <p className="mt-2 text-sm text-zinc-400">Save multiple addresses. Set one default for quick storefront checkout.</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => void submitAddress(e)}>
          <div><Label htmlFor="addr-name">Full name</Label><Input id="addr-name" value={address.fullName} onChange={(e) => setAddress((a) => ({ ...a, fullName: e.target.value }))} required className="mt-1" /></div>
          <div><Label htmlFor="addr-phone">Phone</Label><Input id="addr-phone" value={address.phone} onChange={(e) => setAddress((a) => ({ ...a, phone: e.target.value }))} required className="mt-1" /></div>
          <div><Label htmlFor="addr-region">Region</Label><Input id="addr-region" value={address.region} onChange={(e) => setAddress((a) => ({ ...a, region: e.target.value }))} required className="mt-1" /></div>
          <div><Label htmlFor="addr-city">City / town</Label><Input id="addr-city" value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} required className="mt-1" /></div>
          <div><Label htmlFor="addr-district">District (optional)</Label><Input id="addr-district" value={address.district} onChange={(e) => setAddress((a) => ({ ...a, district: e.target.value }))} className="mt-1" /></div>
          <div><Label htmlFor="addr-locality">Locality / suburb</Label><Input id="addr-locality" value={address.locality} onChange={(e) => setAddress((a) => ({ ...a, locality: e.target.value }))} className="mt-1" /></div>
          <div><Label htmlFor="addr-digital">GhanaPost GPS / digital address</Label><Input id="addr-digital" value={address.digitalAddress} onChange={(e) => setAddress((a) => ({ ...a, digitalAddress: e.target.value }))} className="mt-1" placeholder="e.g. GA-123-4567" /></div>
          <div><Label htmlFor="addr-street">Street address</Label><Input id="addr-street" value={address.streetAddress} onChange={(e) => setAddress((a) => ({ ...a, streetAddress: e.target.value }))} required className="mt-1" /></div>
          <div><Label htmlFor="addr-landmark">Landmark</Label><Input id="addr-landmark" value={address.landmark} onChange={(e) => setAddress((a) => ({ ...a, landmark: e.target.value }))} className="mt-1" /></div>
          <div className="sm:col-span-2"><Label htmlFor="addr-notes">Notes</Label><Textarea id="addr-notes" rows={3} value={address.notes} onChange={(e) => setAddress((a) => ({ ...a, notes: e.target.value }))} className="mt-1" /></div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={address.isDefault} onChange={(e) => setAddress((a) => ({ ...a, isDefault: e.target.checked }))} />
            Set as default address
          </label>
          <div className="sm:col-span-2"><Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save address"}</Button></div>
        </form>

        <div className="mt-6 space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <p className="font-medium text-white">{a.fullName} {a.isDefault ? <span className="text-[var(--brand)]">(Default)</span> : null}</p>
              <p className="mt-1 text-zinc-400">{a.streetAddress}, {a.city}, {a.region}</p>
              <p className="mt-1 text-zinc-500">{a.digitalAddress ?? "No digital address"} · {a.phone}</p>
              <div className="mt-2 flex gap-3 text-xs">
                {!a.isDefault ? <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => void setDefaultAddress(a.id)}>Set default</button> : null}
                <button type="button" className="text-zinc-400 hover:text-white" onClick={() => void deleteAddress(a.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
