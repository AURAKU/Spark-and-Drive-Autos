"use client";

import { CarListingState } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  archiveMotorcycle,
  deleteMotorcycle,
  duplicateMotorcycle,
  publishMotorcycle,
  unpublishMotorcycle,
} from "@/actions/motorcycles";

type Props = {
  id: string;
  slug: string;
  listingState: CarListingState;
};

export function MotorcycleInventoryRowActions({ id, slug, listingState }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDel, setConfirmDel] = useState(false);

  function refresh() {
    startTransition(() => router.refresh());
  }

  const isPublished = listingState === CarListingState.PUBLISHED;
  const isHidden = listingState === CarListingState.HIDDEN;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <Link href={`/motorcycles/${slug}`} className="text-zinc-400 hover:underline" target="_blank">
        View
      </Link>
      <span className="text-zinc-600">·</span>
      <Link href={`/admin/motorcycles/${id}/edit`} className="text-[var(--brand)] hover:underline">
        Edit
      </Link>
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
        onClick={async () => {
          if (!confirmDel) {
            setConfirmDel(true);
            toast.message("Click Delete again to confirm permanent deletion.");
            return;
          }
          const r = await deleteMotorcycle(id);
          if (r.error) {
            toast.error(r.error);
            setConfirmDel(false);
          } else {
            toast.success("Deleted");
            refresh();
          }
        }}
      >
        {confirmDel ? "Confirm delete" : "Delete"}
      </button>
    </div>
  );
}
