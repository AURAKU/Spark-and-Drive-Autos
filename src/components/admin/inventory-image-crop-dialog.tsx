"use client";

import Cropper, { type Area, type Point } from "react-easy-crop";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCroppedImageFile } from "@/lib/image-crop-utils";

type Props = {
  open: boolean;
  imageSrc: string | null;
  fileName?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void | Promise<void>;
};

export function InventoryImageCropDialog({
  open,
  imageSrc,
  fileName = "photo.jpg",
  onOpenChange,
  onConfirm,
}: Props) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels, fileName);
      await onConfirm(file);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-white/10 bg-zinc-950 text-white sm:max-w-2xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>Crop photo</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Drag to reposition, pinch or use the slider to zoom. Crop any region — no fixed aspect ratio.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[min(60vh,420px)] overflow-hidden rounded-xl bg-black">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={undefined}
              restrictPosition={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <label className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="shrink-0">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[var(--brand)]"
          />
        </label>

        <DialogFooter className="border-white/10 bg-zinc-900/50">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[var(--brand)] text-black hover:opacity-90"
            disabled={busy || !imageSrc || !croppedAreaPixels}
            onClick={() => void handleConfirm()}
          >
            {busy ? "Processing…" : "Use cropped photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
