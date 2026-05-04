"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PartForm } from "@/app/admin/parts/part-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Category = { id: string; name: string };

function hrefWithoutAdd(pathname: string, search: string) {
  const p = new URLSearchParams(search);
  p.delete("add");
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

type Props = {
  categories: Category[];
  initialOpen?: boolean;
};

export function AddPartDialog({ categories, initialOpen = false }: Props) {
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
        Add part
      </DialogTrigger>
      <DialogContent
        showCloseButton
        className="sda-dark-dialog-surface max-h-[min(90vh,920px)] overflow-y-auto border border-white/10 bg-[#0a0c10] text-white sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="text-white">New part / accessory</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Create a draft listing. Add gallery images from the edit screen after save.
          </DialogDescription>
        </DialogHeader>
        <PartForm
          mode="create"
          categories={categories}
          onCreated={(id) => {
            setOpen(false);
            router.replace(hrefWithoutAdd(pathname, searchParams.toString()));
            router.push(`/admin/parts/${id}/edit`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
