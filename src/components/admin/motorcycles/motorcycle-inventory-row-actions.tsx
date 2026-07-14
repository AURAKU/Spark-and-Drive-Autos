"use client";

import { CarListingState } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  archiveMotorcycle,
  duplicateMotorcycle,
  publishMotorcycle,
  restoreMotorcycle,
  unpublishMotorcycle,
} from "@/actions/motorcycles";
import { MotorcycleDeleteDialog } from "@/components/admin/motorcycles/motorcycle-delete-dialog";

type Props = {
  id: string;
  slug: string;
  title: string;
  year: number;
  brand: string;
  model: string;
  listingState: CarListingState;
  deletedAt?: string | null;
  orderCount?: number;
};

export function MotorcycleInventoryRowActions({
  id,
  slug,
  title,
  year,
  brand,
  model,
  listingState,
  deletedAt,
  orderCount = 0,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  function refresh() {
    startTransition(() => router.refresh());
  }

  const isPublished = listingState === CarListingState.PUBLISHED;
  const isHidden = listingState === CarListingState.HIDDEN;
  const isDeleted = Boolean(deletedAt);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <Link href={`/admin/motorcycles/${id}`} className="text-zinc-300 hover:underline">
        View
      </Link>
      <span className="text-zinc-600">·</span>
      <Link
        href={`/admin/motorcycles/${id}/edit`}
        className="text-[var(--brand)] hover:underline"
      >
        Edit
      </Link>
      {!isDeleted ? (
        <>
          <span className="text-zinc-600">·</span>
          <button
            type="button"
            disabled={pending}
            className="text-zinc-300 hover:underline disabled:opacity-50"
            onClick={async () => {
              const r = await duplicateMotorcycle(id);
              if (r.error) toast.error(r.error);
              else {
                toast.success("Duplicated as draft");
                if (r.id) router.push(`/admin/motorcycles/${r.id}/edit`);
                else refresh();
              }
            }}
          >
            Duplicate
          </button>
          <span className="text-zinc-600">·</span>
          {isPublished ? (
            <button
              type="button"
              disabled={pending}
              className="text-amber-300 hover:underline disabled:opacity-50"
              onClick={async () => {
                const r = await unpublishMotorcycle(id);
                if (r.error) toast.error(r.error);
                else {
                  toast.success("Unpublished (draft)");
                  refresh();
                }
              }}
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              className="text-emerald-300 hover:underline disabled:opacity-50"
              onClick={async () => {
                const r = await publishMotorcycle(id);
                if (r.error) toast.error(r.error);
                else {
                  toast.success("Published");
                  refresh();
                }
              }}
            >
              Publish
            </button>
          )}
          {!isHidden ? (
            <>
              <span className="text-zinc-600">·</span>
              <button
                type="button"
                disabled={pending}
                className="text-zinc-400 hover:underline disabled:opacity-50"
                onClick={async () => {
                  if (!confirm("Archive (hide) this motorcycle from public inventory?")) return;
                  const r = await archiveMotorcycle(id);
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Archived (hidden)");
                    refresh();
                  }
                }}
              >
                Archive
              </button>
            </>
          ) : null}
          <span className="text-zinc-600">·</span>
          <button
            type="button"
            disabled={pending}
            className="text-red-400 hover:underline disabled:opacity-50"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </button>
        </>
      ) : (
        <>
          <span className="text-zinc-600">·</span>
          <button
            type="button"
            disabled={pending}
            className="text-emerald-300 hover:underline disabled:opacity-50"
            onClick={async () => {
              const r = await restoreMotorcycle(id);
              if (r.error) toast.error(r.error);
              else {
                toast.success("Restored as draft");
                refresh();
              }
            }}
          >
            Restore
          </button>
        </>
      )}

      <MotorcycleDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        motorcycle={{ id, slug, title, year, brand, model, orderCount }}
        onDeleted={() => refresh()}
      />
    </div>
  );
}
