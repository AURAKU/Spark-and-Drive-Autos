"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteMotorcycle } from "@/actions/motorcycles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  motorcycle: {
    id: string;
    title: string;
    year: number;
    slug: string;
    brand: string;
    model: string;
    orderCount?: number;
  };
  onDeleted?: (mode: "hard" | "soft") => void;
};

export function MotorcycleDeleteDialog({ open, onOpenChange, motorcycle, onDeleted }: Props) {
  const [pending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);
  const hasOrders = (motorcycle.orderCount ?? 0) > 0;

  function reset() {
    setConfirmed(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete motorcycle?</DialogTitle>
          <DialogDescription>
            You are about to remove {motorcycle.year} {motorcycle.brand} {motorcycle.model} ({motorcycle.title}). Stock
            ref: {motorcycle.slug}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          {hasOrders ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">
              This listing has order history. It will be soft-deleted / archived and removed from public inventory while
              preserving accounting records.
            </p>
          ) : (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-100">
              This will permanently delete the motorcycle and its media metadata. Cloudinary assets are cleaned up when
              possible.
            </p>
          )}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>I understand this action and want to continue.</span>
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed || pending}
            onClick={() => {
              startTransition(async () => {
                const r = await deleteMotorcycle(motorcycle.id);
                if (r.error) {
                  toast.error(r.error);
                  return;
                }
                toast.success(r.mode === "soft" ? "Archived (soft-deleted)." : "Motorcycle deleted.");
                onOpenChange(false);
                onDeleted?.(r.mode === "soft" ? "soft" : "hard");
              });
            }}
          >
            {pending ? "Deleting…" : hasOrders ? "Archive / soft-delete" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
