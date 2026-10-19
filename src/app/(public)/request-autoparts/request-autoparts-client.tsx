"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeading } from "@/components/typography/page-headings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CLOUDINARY_USER_MESSAGE, readPublicCloudinaryCloudName } from "@/lib/cloudinary-config-public";

const CALLBACK = "/request-autoparts";
const MAX_IMAGES = 8;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

async function uploadPartReference(file: File, uploadSessionId: string) {
  const sigRes = await fetch("/api/upload/parts-request-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadSessionId }),
  });
  const raw = await sigRes.text();
  let data = {} as {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName?: string;
    folder: string;
    uploadUrl?: string;
    error?: string;
  };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    data = {} as typeof data;
  }
  const errMsg = typeof data.error === "string" ? data.error : "";
  if (sigRes.status === 501) {
    console.warn("[request-autoparts] Cloudinary not configured (501)");
    throw new Error(errMsg || CLOUDINARY_USER_MESSAGE);
  }
  if (sigRes.status === 401) throw new Error("Your session expired. Please sign in again.");
  if (!sigRes.ok) throw new Error(errMsg || "Could not start upload.");
  const cloud = data.cloudName?.trim() || readPublicCloudinaryCloudName() || "";
  let uploadUrl = data.uploadUrl?.trim();
  if (!uploadUrl && cloud) {
    uploadUrl = `https://api.cloudinary.com/v1_1/${cloud}/image/upload`;
  }
  if (!uploadUrl) throw new Error("Upload address missing. Check Cloudinary configuration.");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", data.apiKey);
  fd.append("timestamp", String(data.timestamp));
  fd.append("signature", data.signature);
  fd.append("folder", data.folder);
  const up = await fetch(uploadUrl, { method: "POST", body: fd });
  if (!up.ok) {
    const err = await up.text();
    throw new Error(err || "Upload failed");
  }
  const json = (await up.json()) as { secure_url: string };
  return json.secure_url;
}

export function RequestAutopartsClient() {
  const { data: session, status } = useSession();
  const uploadSessionId = useRef(crypto.randomUUID());
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feeGhs, setFeeGhs] = useState(30);
  const [feeEnabled, setFeeEnabled] = useState(true);
  const [paidNote, setPaidNote] = useState<string | null>(null);
  const signedIn = status === "authenticated" && Boolean(session?.user);

  const registerHref = `/register?callbackUrl=${encodeURIComponent(CALLBACK)}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(CALLBACK)}`;

  useEffect(() => {
    void fetch("/api/part-sourcing-requests/fee")
      .then((res) => res.json())
      .then((data: { feeGhs?: number; enabled?: boolean }) => {
        if (typeof data.feeGhs === "number") setFeeGhs(data.feeGhs);
        if (typeof data.enabled === "boolean") setFeeEnabled(data.enabled);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const reference = searchParams.get("reference");
    if (!reference) return;
    void fetch(`/api/part-sourcing-requests/confirm?reference=${encodeURIComponent(reference)}`)
      .then((res) => res.json())
      .then((data: { ok?: boolean; threadId?: string | null }) => {
        if (data.ok) {
          setPaidNote(
            data.threadId
              ? "Payment received. Your request is with the team, and replies will appear in your messages."
              : "Payment received. Your request is with the team.",
          );
        }
      })
      .catch(() => undefined);
  }, [searchParams]);

  async function onPickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (!files?.length) return;
    if (imageUrls.length >= MAX_IMAGES) {
      toast.error(`You can attach up to ${MAX_IMAGES} images.`);
      return;
    }
    setUploading(true);
    try {
      const next: string[] = [...imageUrls];
      for (const file of Array.from(files)) {
        if (next.length >= MAX_IMAGES) break;
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image.`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name} is too large (max 5 MB).`);
          continue;
        }
        const url = await uploadPartReference(file, uploadSessionId.current);
        next.push(url);
      }
      setImageUrls(next);
      if (next.length > imageUrls.length) toast.success("Image(s) attached.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  }

  async function pay(method: "wallet" | "paystack", form: HTMLFormElement) {
    const fd = new FormData(form);
    setSubmitting(true);
    try {
      const res = await fetch("/api/part-sourcing-requests/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          summaryTitle: (fd.get("summaryTitle") as string)?.trim() || null,
          description: fd.get("description"),
          vehicleMake: (fd.get("vehicleMake") as string)?.trim() || null,
          vehicleModel: (fd.get("vehicleModel") as string)?.trim() || null,
          vehicleYear: fd.get("vehicleYear") ? Number(fd.get("vehicleYear")) : null,
          partNumber: (fd.get("partNumber") as string)?.trim() || null,
          quantity: fd.get("quantity") ? Number(fd.get("quantity")) : 1,
          urgency: fd.get("urgency") || "normal",
          deliveryCity: (fd.get("deliveryCity") as string)?.trim() || null,
          guestName: (fd.get("guestName") as string)?.trim() || null,
          guestEmail: (fd.get("guestEmail") as string)?.trim() || null,
          guestPhone: (fd.get("guestPhone") as string)?.trim() || null,
          imageUrls,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; authorizationUrl?: string; threadId?: string | null };
      if (!res.ok) throw new Error(data.error ?? "Payment could not start.");
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
        return;
      }
      toast.success("Payment received. Your request is with the team.");
      form.reset();
      setImageUrls([]);
      uploadSessionId.current = crypto.randomUUID();
      if (data.threadId) setPaidNote("Replies will appear in your messages.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-zinc-500 sm:px-6">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <PageHeading>Request AutoParts or Accessories</PageHeading>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Tell us the part and the vehicle. A request fee of GHS {feeGhs.toLocaleString()} is charged before we start.
        Replies come back in{" "}
        <Link href="/dashboard/chats" className="text-[var(--brand)] hover:underline">
          your messages
        </Link>
        .
      </p>
      {paidNote ? <p className="mt-3 text-sm text-emerald-200">{paidNote}</p> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void pay("paystack", event.currentTarget);
        }}
        className="mt-10 grid gap-4 sm:grid-cols-2"
      >
        {signedIn ? null : (
          <>
            <div>
              <Label htmlFor="guestName">Your name</Label>
              <Input id="guestName" name="guestName" required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="guestEmail">Email</Label>
              <Input id="guestEmail" name="guestEmail" type="email" required className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="guestPhone">Phone</Label>
              <Input id="guestPhone" name="guestPhone" required className="mt-1" />
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <Label htmlFor="summaryTitle">Short title (optional)</Label>
          <Input
            id="summaryTitle"
            name="summaryTitle"
            placeholder="e.g. Front brake pads + sensor for 2019 RAV4"
            className="mt-1"
            maxLength={200}
            defaultValue={searchParams.get("q") ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="description">What do you need?</Label>
          <Textarea
            id="description"
            name="description"
            required
            rows={6}
            className="mt-1"
            placeholder="Brand, part type, condition (new / OEM / aftermarket), timeline, and anything else we should know."
            defaultValue={searchParams.get("description") ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="vehicleMake">Vehicle make (optional)</Label>
          <Input id="vehicleMake" name="vehicleMake" className="mt-1" placeholder="Toyota" defaultValue={searchParams.get("vehicleMake") ?? ""} />
        </div>
        <div>
          <Label htmlFor="vehicleModel">Vehicle model (optional)</Label>
          <Input id="vehicleModel" name="vehicleModel" className="mt-1" placeholder="RAV4" defaultValue={searchParams.get("vehicleModel") ?? ""} />
        </div>
        <div>
          <Label htmlFor="vehicleYear">Year (optional)</Label>
          <Input id="vehicleYear" name="vehicleYear" type="number" min={1950} max={2035} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="partNumber">Part / OEM number (optional)</Label>
          <Input id="partNumber" name="partNumber" className="mt-1" defaultValue={searchParams.get("partNumber") ?? ""} />
        </div>
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" name="quantity" type="number" min={1} max={999} defaultValue={1} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="urgency">How soon do you need it?</Label>
          <select
            id="urgency"
            name="urgency"
            defaultValue="normal"
            className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
          >
            <option value="normal">Normal</option>
            <option value="soon">Within a few weeks</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="deliveryCity">City / region for delivery or pickup (optional)</Label>
          <Input id="deliveryCity" name="deliveryCity" className="mt-1" placeholder="Accra" />
        </div>

        {signedIn ? (
        <div className="sm:col-span-2">
          <Label>Reference photos (optional, up to {MAX_IMAGES})</Label>
          <p className="mt-1 text-xs text-zinc-500">PNG or JPEG, max 5 MB each. Photos of old parts, VIN plates, or packaging help.</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading || imageUrls.length >= MAX_IMAGES}
              onChange={onPickImages}
              className="max-w-xs cursor-pointer text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
            />
            {uploading ? <span className="text-xs text-zinc-500">Uploading…</span> : null}
          </div>
          {imageUrls.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-3">
              {imageUrls.map((url) => (
                <li key={url} className="relative size-24 overflow-hidden rounded-lg border border-white/10">
                  <Image src={url} alt="" fill className="object-cover" sizes="96px" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-black"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        ) : null}

        <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-white">Request fee · GHS {feeGhs.toLocaleString()}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Payment is the last step. We receive the request only after it succeeds
            {signedIn ? ", from your wallet or Paystack" : " through Paystack"}.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {signedIn ? (
              <Button type="button" disabled={submitting || uploading || !feeEnabled} onClick={(event) => void pay("wallet", event.currentTarget.form!)}>
                {submitting ? "Processing…" : "Pay with wallet"}
              </Button>
            ) : (
              <Link href={loginHref} className="text-sm text-[var(--brand)] hover:underline">
                Sign in to pay with wallet
              </Link>
            )}
            <Button type="submit" disabled={submitting || uploading || !feeEnabled} variant="outline">
              {submitting ? "Processing…" : "Pay with Paystack"}
            </Button>
          </div>
          {!signedIn ? (
            <p className="mt-3 text-xs text-zinc-500">
              Photos can be attached after you{" "}
              <Link href={registerHref} className="text-[var(--brand)] hover:underline">
                create an account
              </Link>
              . Guests can still pay, and the reply stays in messages on this browser.
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
