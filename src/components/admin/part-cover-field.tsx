"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { uploadFileToCloudinary } from "@/lib/cloudinary-upload-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialUrl?: string | null;
  initialPublicId?: string | null;
};

export function PartCoverField({ initialUrl, initialPublicId }: Props) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [publicId, setPublicId] = useState(initialPublicId ?? "");
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    setUploading(true);
    try {
      const json = await uploadFileToCloudinary(file, "spark-drive/parts", "image");
      setUrl(json.secure_url);
      setPublicId(json.public_id);
      toast.success("Cover image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="coverImageUrl" value={url} readOnly />
      <input type="hidden" name="coverImagePublicId" value={publicId} readOnly />
      <div>
        <Label htmlFor="cover-upload">Cover image</Label>
        <p className="mt-1 text-xs text-zinc-500">Upload to Cloudinary or paste a URL below.</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id="cover-upload"
            type="file"
            accept="image/*"
            className="text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-white"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          {uploading ? <span className="text-xs text-zinc-500">Uploading…</span> : null}
        </div>
      </div>
      <div>
        <Label htmlFor="cover-url-manual">Image URL (optional override)</Label>
        <Input
          id="cover-url-manual"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1"
        />
      </div>
      {url ? (
        <div className="relative h-40 w-full max-w-xs overflow-hidden rounded-xl border border-white/10 bg-black/30">
          <Image src={url} alt="" fill className="object-cover" sizes="320px" unoptimized />
        </div>
      ) : null}
      <Button type="button" variant="outline" size="sm" className="border-white/15" onClick={() => { setUrl(""); setPublicId(""); }}>
        Clear cover
      </Button>
    </div>
  );
}
