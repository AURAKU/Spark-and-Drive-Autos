"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { NewCarForm } from "@/app/admin/cars/new/new-car-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  /** Open when `/admin/cars?add=1` */
  initialOpen?: boolean;
};

function hrefWithoutAdd(pathname: string, search: string) {
  const p = new URLSearchParams(search);
  p.delete("add");
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function AddVehicleDialog({ initialOpen = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(initialOpen);

  useEffect(() => {
    setOpen(initialOpen);
  }, [initialOpen]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          router.replace(hrefWithoutAdd(pathname, searchParams.toString()));
        }
      }}
    >
      <DialogTrigger className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg bg-white px-3 text-sm font-medium text-black transition hover:bg-white/90">
        Add vehicle
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="sda-dark-dialog-surface max-h-[min(90vh,880px)] overflow-y-auto border border-white/10 bg-[#0a0c10] text-white sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="text-white">New vehicle</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create a draft listing. You can add media from the edit screen after save.
          </DialogDescription>
        </DialogHeader>
        <NewCarForm
          onCreated={(id) => {
            setOpen(false);
            router.replace(hrefWithoutAdd(pathname, searchParams.toString()));
            router.push(`/admin/cars/${id}/edit`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
