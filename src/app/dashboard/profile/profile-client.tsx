"use client";

import Image from "next/image";
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

export function ProfileClient({
  email,
  name,
  ghanaCardIdNumber,
  ghanaCardImageUrl,
  walletBalance,
  addresses,
}: {
  email: string | null | undefined;
  name: string | null | undefined;
  ghanaCardIdNumber: string | null;
  ghanaCardImageUrl: string | null;
  walletBalance: number;
  addresses: AddressRow[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const walletRef = params.get("walletRef");

  const [loading, setLoading] = useState(false);
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
  const [ghanaCardId, setGhanaCardId] = useState(ghanaCardIdNumber ?? "");
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

  async function uploadGhanaCard(file: File) {
    const sigRes = await fetch("/api/upload/profile-id-signature", { method: "POST" });
    if (!sigRes.ok) throw new Error("Could not sign upload");
    const sig = (await sigRes.json()) as {
      timestamp: number;
      signature: string;
      apiKey: string;
      folder: string;
      uploadUrl: string;
    };
    const fd = new FormData();
    fd.append("file", file);
    fd.append("api_key", sig.apiKey);
    fd.append("timestamp", String(sig.timestamp));
    fd.append("signature", sig.signature);
    fd.append("folder", sig.folder);
    const up = await fetch(sig.uploadUrl, { method: "POST", body: fd });
    if (!up.ok) throw new Error("Upload failed");
    const json = (await up.json()) as { secure_url: string; public_id: string };
    const save = await fetch("/api/profile/ghana-card", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ghanaCardIdNumber: ghanaCardId, imageUrl: json.secure_url, imagePublicId: json.public_id }),
    });
    if (!save.ok) throw new Error("Could not save Ghana Card details");
  }

  async function onUploadCard(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoading(true);
    try {
      await uploadGhanaCard(file);
      toast.success("Ghana Card uploaded");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-300">
        <h2 className="text-lg font-semibold text-white">Account</h2>
        <p className="mt-2"><span className="text-zinc-500">Name:</span> {name ?? "—"}</p>
        <p className="mt-1"><span className="text-zinc-500">Email:</span> {email ?? "—"}</p>
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
        <h2 className="text-lg font-semibold text-white">Ghana Card verification</h2>
        <p className="mt-2 text-sm text-zinc-400">Upload Ghana Card ID photo and ID number for delivery/checkout verification.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="space-y-3">
            <div>
              <Label htmlFor="gh-card-id">Ghana Card ID number</Label>
              <Input id="gh-card-id" value={ghanaCardId} onChange={(e) => setGhanaCardId(e.target.value)} className="mt-1" placeholder="e.g. GHA-123456789-0" />
            </div>
            <div>
              <input id="gh-card-upload" type="file" accept="image/*" className="hidden" onChange={(e) => void onUploadCard(e)} />
              <label htmlFor="gh-card-upload" className="inline-flex h-9 cursor-pointer items-center rounded-md border border-white/15 px-4 text-sm text-zinc-200 hover:bg-white/10">
                Upload Ghana Card photo
              </label>
            </div>
          </div>
          <div className="relative h-28 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            {ghanaCardImageUrl ? <Image src={ghanaCardImageUrl} alt="Ghana Card ID" fill className="object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-xs text-zinc-500">No ID photo</div>}
          </div>
        </div>
      </div>

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
