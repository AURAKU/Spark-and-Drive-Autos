import Link from "next/link";
import { notFound } from "next/navigation";

import { MotorcycleMediaPanel } from "@/components/admin/motorcycles/motorcycle-media-panel";
import { PageHeading } from "@/components/typography/page-headings";
import { prisma } from "@/lib/prisma";

import { MotorcycleEditForm } from "./motorcycle-edit-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditMotorcyclePage(props: Props) {
  const { id } = await props.params;
  const motorcycle = await prisma.motorcycle.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      videos: { orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }] },
    },
  });
  if (!motorcycle) notFound();

  return (
    <div>
      <PageHeading variant="dashboard">Edit motorcycle</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Listing: <span className="font-mono text-zinc-200">{motorcycle.slug}</span> ·{" "}
        <Link className="text-[var(--brand)] hover:underline" href={`/motorcycles/${motorcycle.slug}`}>
          View public page
        </Link>
        {" · "}
        <Link className="text-zinc-400 hover:underline" href="/admin/motorcycles">
          Back to inventory
        </Link>
      </p>
      <MotorcycleEditForm motorcycle={motorcycle} />
      <div className="mt-12 border-t border-white/10 pt-10">
        <h2 className="text-lg font-semibold text-white">Photos &amp; video</h2>
        <p className="mt-1 text-sm text-zinc-500">Upload gallery images and walkthrough clips.</p>
        <div className="mt-6">
          <MotorcycleMediaPanel motorcycleId={motorcycle.id} images={motorcycle.images} videos={motorcycle.videos} />
        </div>
      </div>
    </div>
  );
}
