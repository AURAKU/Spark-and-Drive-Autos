"use client";

import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeading } from "@/components/typography/page-headings";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const CALLBACK = "/request-autoparts";
const MAX_IMAGES = 8;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

async function uploadPartReference(file: File, uploadSessionId: string) {
  const sigRes = await fetch("/api/upload/parts-request-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadSessionId }),
  });
  if (sigRes.status === 501) throw new Error("Image uploads are not configured yet.");
  if (sigRes.status === 401) throw new Error("Your session expired. Please sign in again.");
  if (!sigRes.ok) throw new Error("Could not start upload.");
  const data = (await sigRes.json()) as {
    timestamp: number;
    signature: string;
    apiKey: string;
    folder: string;
    uploadUrl: string;
  };
  const fd = new FormData();
  fd.append("file", file);
  fd.append("api_key", data.apiKey);
  fd.append("timestamp", String(data.timestamp));
  fd.append("signature", data.signature);
  fd.append("folder", data.folder);
  const up = await fetch(data.uploadUrl, { method: "POST", body: fd });
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
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const registerHref = `/register?callbackUrl=${encodeURIComponent(CALLBACK)}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(CALLBACK)}`;

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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session?.user) {
      toast.error("Sign in to submit this form.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const res = await fetch("/api/part-sourcing-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summaryTitle: (fd.get("summaryTitle") as string)?.trim() || null,
          description: fd.get("description"),
          vehicleMake: (fd.get("vehicleMake") as string)?.trim() || null,
          vehicleModel: (fd.get("vehicleModel") as string)?.trim() || null,
          vehicleYear: fd.get("vehicleYear") ? Number(fd.get("vehicleYear")) : null,
          partNumber: (fd.get("partNumber") as string)?.trim() || null,
          quantity: fd.get("quantity") ? Number(fd.get("quantity")) : 1,
          urgency: fd.get("urgency") || "normal",
          deliveryCity: (fd.get("deliveryCity") as string)?.trim() || null,
          imageUrls,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not submit");
      toast.success("Request sent. Our parts team will follow up.");
      e.currentTarget.reset();
      setImageUrls([]);
      uploadSessionId.current = crypto.randomUUID();
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

  if (status !== "authenticated" || !session.user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <PageHeading>Request AutoParts or Accessories</PageHeading>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Submitting a sourcing request (including reference photos) requires a free account so we can match your
          enquiry to you, send updates, and keep everything in one thread. Create Account or sign in to continue.
        </p>
        <p className="mt-3 text-sm text-zinc-500">
          You can still{" "}
          <Link href="/parts" className="text-[var(--brand)] hover:underline">
            browse the parts catalog
          </Link>{" "}
          without signing in.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={registerHref}
            className={cn(
              buttonVariants({ size: "default" }),
              "bg-[var(--brand)] text-center font-semibold text-black hover:opacity-90",
            )}
          >
            Create Account
          </Link>
          <Link
            href={loginHref}
            className={cn(buttonVariants({ variant: "outline", size: "default" }), "border-white/20 text-center")}
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <PageHeading>Request AutoParts or Accessories</PageHeading>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        Describe what you need — part numbers, symptoms, or photos of labels and damage all help. You can attach up to{" "}
        {MAX_IMAGES} reference images. Track submissions alongside vehicle requests in{" "}
        <Link href="/dashboard/inquiry-requests#sourcing" className="text-[var(--brand)] hover:underline">
          your dashboard
        </Link>
        .
      </p>

      <form onSubmit={onSubmit} className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="summaryTitle">Short title (optional)</Label>
          <Input
            id="summaryTitle"
            name="summaryTitle"
            placeholder="e.g. Front brake pads + sensor for 2019 RAV4"
            className="mt-1"
            maxLength={200}
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
          />
        </div>
        <div>
          <Label htmlFor="vehicleMake">Vehicle make (optional)</Label>
          <Input id="vehicleMake" name="vehicleMake" className="mt-1" placeholder="Toyota" />
        </div>
        <div>
          <Label htmlFor="vehicleModel">Vehicle model (optional)</Label>
          <Input id="vehicleModel" name="vehicleModel" className="mt-1" placeholder="RAV4" />
        </div>
        <div>
          <Label htmlFor="vehicleYear">Year (optional)</Label>
          <Input id="vehicleYear" name="vehicleYear" type="number" min={1950} max={2035} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="partNumber">Part / OEM number (optional)</Label>
          <Input id="partNumber" name="partNumber" className="mt-1" />
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

        <div className="sm:col-span-2">
          <Button type="submit" disabled={submitting || uploading}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
