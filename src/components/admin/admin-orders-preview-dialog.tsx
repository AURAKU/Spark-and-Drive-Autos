"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AdminOrderPreviewPayload } from "@/lib/admin-orders-list-serialize";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  preview: AdminOrderPreviewPayload | null;
  itemHref: string | null;
  orderAdminHref: string;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AdminOrdersPreviewDialog({ open, onOpenChange, preview, itemHref, orderAdminHref }: Props) {
  const [imgBroken, setImgBroken] = useState(false);

  useEffect(() => {
    setImgBroken(false);
  }, [preview?.imageUrl, preview?.orderNumber]);

  if (!preview) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Order item preview</DialogTitle>
          <DialogDescription>
            {preview.orderNumber} · {preview.itemTypeLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted/40">
            {preview.imageUrl && !imgBroken ? (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary supplier URLs; fail gracefully via onError
              <img
                src={preview.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setImgBroken(true)}
              />
            ) : (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                <span className="text-2xl opacity-40">◻</span>
                <span>No image on file</span>
              </div>
            )}
          </div>

          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Item</dt>
              <dd className="font-medium text-foreground">{preview.itemTitle}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Customer</dt>
              <dd className="text-foreground/90">
                {preview.customerName}
                <br />
                <span className="text-muted-foreground">{preview.customerEmail}</span>
                {preview.customerPhone !== "—" ? (
                  <>
                    <br />
                    <span className="text-muted-foreground">{preview.customerPhone}</span>
                  </>
                ) : null}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Quantity</dt>
                <dd>{preview.quantityLabel}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">List / total</dt>
                <dd>{preview.productPrice}</dd>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Paid</dt>
                <dd>{preview.depositPaid}</dd>
              </div>
              <div>
                <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Outstanding</dt>
                <dd>{preview.outstanding}</dd>
              </div>
            </div>
            <div>
              <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Payment</dt>
              <dd>
                {preview.paymentStatus} · {preview.paymentType}
              </dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Delivery</dt>
              <dd className="break-words">{preview.deliveryMode}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Shipping fee</dt>
              <dd>{preview.shippingFeeStatus}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Order date</dt>
              <dd>{formatWhen(preview.orderDateIso)}</dd>
            </div>
            {preview.dueOrEta ? (
              <div>
                <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">ETA / due note</dt>
                <dd>{preview.dueOrEta}</dd>
              </div>
            ) : null}
            {preview.adminNotes ? (
              <div>
                <dt className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Admin notes</dt>
                <dd className="whitespace-pre-wrap text-muted-foreground">{preview.adminNotes}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {itemHref ? (
              <Link
                href={itemHref}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Open listing
              </Link>
            ) : null}
            <Link href={orderAdminHref} className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              Admin order detail
            </Link>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
