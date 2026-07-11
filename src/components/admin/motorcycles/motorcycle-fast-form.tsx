"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EngineType, MotorcycleType, SourceType, CarListingState } from "@prisma/client";
import { toast } from "sonner";

import { createMotorcycle } from "@/actions/motorcycles";
import { InventoryMediaSourcePicker } from "@/components/admin/inventory-media-source-picker";
import { optimizeCloudinaryUrl } from "@/lib/cloudinary-delivery";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload-client";
import {
  MotorcycleCreateMediaField,
  uploadQueuedMotorcycleMedia,
  type MotorcycleCreateMediaState,
} from "@/components/admin/motorcycles/motorcycle-create-media-field";
import {
  MOTORCYCLE_FEATURE_TAGS,
  MOTORCYCLE_HIGHLIGHT_TAGS,
} from "@/lib/motorcycle-spec-parser";

const STEPS = ["Basic", "Media", "Price & Shipping", "Advanced"] as const;
const MOTORCYCLE_TYPES = Object.values(MotorcycleType);
const ENGINE_TYPES = Object.values(EngineType);

export function MotorcycleFastForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverPublicId, setCoverPublicId] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);

  async function onCoverFilesReady(files: File[]) {
    const file = files[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const uploaded = await uploadFileToCloudinary(file, "sda/admin/motorcycles/staging", "image");
      setCoverUrl(uploaded.secure_url);
      setCoverPublicId(uploaded.public_id);
      toast.success("Cover photo ready.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cover upload failed.");
    } finally {
      setCoverUploading(false);
    }
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!coverUrl) {
      setError("Add a cover photo before publishing.");
      setStep(1);
      return;
    }
    setPending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("featureTags", features.join(","));
    fd.set("highlightTags", highlights.join(","));
    fd.set("coverImageUrl", media.coverUrl);
    if (media.coverPublicId) fd.set("coverImagePublicId", media.coverPublicId);
    const result = await createMotorcycle(null, fd);
    if (result.error) {
      setPending(false);
      setError(typeof result.error === "string" ? result.error : "Could not save.");
      return;
    }
    if (result.id) {
      try {
        if (media.extraImages.length > 0 || media.videos.length > 0) {
          await uploadQueuedMotorcycleMedia(result.id, media);
        }
      } catch (uploadError) {
        setPending(false);
        setError(
          uploadError instanceof Error
            ? `Motorcycle saved, but gallery upload failed: ${uploadError.message}`
            : "Motorcycle saved, but gallery upload failed.",
        );
        router.push(`/admin/motorcycles/${result.id}/edit`);
        return;
      }
      router.push(`/admin/motorcycles/${result.id}/edit`);
    }
    setPending(false);
  }

  function goToNextStep() {
    if (step === 1 && !media.coverUrl.trim()) {
      setError("Upload or paste a cover photo before continuing.");
      return;
    }
    setError(null);
    setStep(step + 1);
  }

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <nav className="flex gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-lg px-3 py-1.5 text-sm ${step === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </nav>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Manufacturer *<input name="brand" required className={inputCls} /></label>
          <label className="text-xs text-muted-foreground">Model *<input name="model" required className={inputCls} /></label>
          <label className="text-xs text-muted-foreground">Year *<input name="year" type="number" required defaultValue={2024} className={inputCls} /></label>
          <label className="text-xs text-muted-foreground">Fuel type *
            <select name="engineType" required className={inputCls} defaultValue={EngineType.GASOLINE_PETROL}>
              {ENGINE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Motorcycle type *
            <select name="motorcycleType" required className={inputCls} defaultValue={MotorcycleType.SPORT}>
              {MOTORCYCLE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Mileage (km) *<input name="mileage" type="number" required defaultValue={0} className={inputCls} /></label>
          <label className="text-xs text-muted-foreground">Condition *
            <select name="condition" required className={inputCls} defaultValue="Brand New">
              <option>Brand New</option>
              <option>Used</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground sm:col-span-2">Description *
            <textarea name="longDescription" required rows={4} className={inputCls} placeholder="Describe the bike…" />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add a cover photo from your device or camera. Crop any region before upload — no fixed aspect ratio.
            More gallery media can be added on the edit page after saving.
          </p>
          <InventoryMediaSourcePicker
            kind="image"
            multiple={false}
            disabled={coverUploading}
            uploadLabel={coverUploading ? "Uploading…" : "Choose cover photo"}
            onFilesReady={onCoverFilesReady}
          />
          {coverUrl ? (
            <div className="relative aspect-[16/10] max-w-md overflow-hidden rounded-xl border border-border dark:border-white/10">
              <Image
                src={optimizeCloudinaryUrl(coverUrl, "card")}
                alt="Cover preview"
                fill
                className="object-cover"
                sizes="400px"
              />
            </div>
          ) : (
            <p className="text-xs text-destructive">Cover photo is required before publishing.</p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">Price *<input name="basePriceAmount" type="number" required className={inputCls} /></label>
          <label className="text-xs text-muted-foreground">Currency *
            <select name="basePriceCurrency" className={inputCls} defaultValue="USD">
              <option value="USD">USD</option>
              <option value="GHS">GHS</option>
              <option value="CNY">CNY</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Stock location *
            <select name="sourceType" required className={inputCls} defaultValue={SourceType.IN_CHINA}>
              <option value={SourceType.IN_CHINA}>China</option>
              <option value={SourceType.IN_GHANA}>Ghana</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Reservation deposit %<input name="reservationDepositPercent" type="number" defaultValue={80} className={inputCls} /></label>
          <label className="text-xs text-muted-foreground">Estimated delivery<input name="estimatedDelivery" defaultValue="35–45 Days" className={inputCls} /></label>
          <label className="text-xs text-muted-foreground">Sea freight (GHS)<input name="seaShippingFeeGhs" type="number" className={inputCls} /></label>
          <label className="text-xs text-muted-foreground">Publish state
            <select name="listingState" className={inputCls} defaultValue={CarListingState.PUBLISHED}>
              <option value={CarListingState.DRAFT}>Draft</option>
              <option value={CarListingState.PUBLISHED}>Publish</option>
            </select>
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <details className="rounded-lg border border-border p-4 dark:border-white/10">
            <summary className="cursor-pointer text-sm font-medium">Advanced specifications (optional)</summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs">Engine CC<input name="engineCc" type="number" className={inputCls} /></label>
              <label className="text-xs">VIN<input name="vin" className={inputCls} /></label>
              <label className="text-xs">Color<input name="color" className={inputCls} /></label>
              <label className="text-xs">Transmission<input name="transmission" className={inputCls} /></label>
              <label className="text-xs sm:col-span-2">Specifications (plain text)
                <textarea name="specificationsText" rows={6} className={inputCls} placeholder={"Engine: 249cc\nPower: 28HP\nRange: 150km"} />
              </label>
            </div>
          </details>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Feature tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOTORCYCLE_FEATURE_TAGS.map((t) => (
                <button key={t} type="button" onClick={() => toggleTag(features, setFeatures, t)} className={`rounded-full px-2 py-1 text-xs border ${features.includes(t) ? "border-primary bg-primary/10" : "border-border"}`}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Highlights</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOTORCYCLE_HIGHLIGHT_TAGS.map((t) => (
                <button key={t} type="button" onClick={() => toggleTag(highlights, setHighlights, t)} className={`rounded-full px-2 py-1 text-xs border ${highlights.includes(t) ? "border-primary bg-primary/10" : "border-border"}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="rounded-lg border border-border px-4 py-2 text-sm">Back</button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => {
              if (step === 1 && !coverUrl) {
                toast.error("Add a cover photo before continuing.");
                return;
              }
              setStep(step + 1);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Next
          </button>
        ) : (
          <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60">
            {pending ? "Publishing…" : "Publish motorcycle"}
          </button>
        )}
      </div>
    </form>
  );
}
