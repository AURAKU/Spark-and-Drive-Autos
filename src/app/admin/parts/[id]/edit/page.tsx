import Link from "next/link";
import { notFound } from "next/navigation";

import { deletePart } from "@/actions/parts";
import { PageHeading } from "@/components/typography/page-headings";
import { PartMediaPanel } from "@/components/admin/part-media-panel";
import { canonicalRmbToAdminAmount, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

import { PartForm } from "../../part-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminEditPartPage(props: Props) {
  const { id } = await props.params;
  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      videos: { orderBy: { sortOrder: "asc" } },
    },
  });
  const categories = await prisma.partCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  if (!part) notFound();
  const settings = await getGlobalCurrencySettings();
  const fx = {
    usdToRmb: Number(settings.usdToRmb),
    rmbToGhs: Number(settings.rmbToGhs),
    usdToGhs: Number(settings.usdToGhs),
  };
  const sellCur = parseDisplayCurrency(part.sellingPriceCurrency);
  const supCur = parseDisplayCurrency(part.supplierCostCurrency);
  const sellingDisplayAmount = canonicalRmbToAdminAmount(Number(part.basePriceRmb), sellCur, fx);
  const supplierDisplayAmount =
    part.supplierCostRmb != null ? canonicalRmbToAdminAmount(Number(part.supplierCostRmb), supCur, fx) : null;
  const partForForm = {
    id: part.id,
    slug: part.slug,
    title: part.title,
    shortDescription: part.shortDescription,
    description: part.description,
    category: part.category,
    categoryId: part.categoryId,
    origin: part.origin,
    sku: part.sku,
    partNumber: part.partNumber,
    oemNumber: part.oemNumber,
    compatibleMake: part.compatibleMake,
    compatibleModel: part.compatibleModel,
    compatibleYearNote: part.compatibleYearNote,
    brand: part.brand,
    condition: part.condition,
    warehouseLocation: part.warehouseLocation,
    countryOfOrigin: part.countryOfOrigin,
    internalNotes: part.internalNotes,
    basePriceRmb: Number(part.basePriceRmb),
    supplierCostRmb: part.supplierCostRmb != null ? Number(part.supplierCostRmb) : null,
    priceGhs: Number(part.priceGhs),
    sellingPriceCurrency: sellCur,
    supplierCostCurrency: supCur,
    sellingDisplayAmount,
    supplierDisplayAmount,
    stockQty: part.stockQty,
    stockStatus: part.stockStatus,
    stockStatusLocked: part.stockStatusLocked,
    listingState: part.listingState,
    tags: part.tags,
    coverImageUrl: part.coverImageUrl,
    coverImagePublicId: part.coverImagePublicId,
    featured: part.featured,
    metaJson: part.metaJson,
    supplierDistributorRef: part.supplierDistributorRef,
    supplierDistributorPhone: part.supplierDistributorPhone,
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageHeading variant="dashboard">Edit part</PageHeading>
          <p className="mt-2 text-sm text-zinc-400">
            Manage listing content, stock, and media. Public URL:{" "}
            <Link className="text-[var(--brand)] hover:underline" href={`/parts/${part.slug}`}>
              /parts/{part.slug}
            </Link>
          </p>
        </div>
        <form action={deletePart}>
          <input type="hidden" name="id" value={part.id} />
          <button
            type="submit"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20"
          >
            Delete listing
          </button>
        </form>
      </div>

      <PartForm mode="edit" part={partForForm} categories={categories} />

      <div className="mt-12 border-t border-white/10 pt-10">
        <h2 className="text-lg font-semibold text-white">Media</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Upload multiple photos and videos, drag to reorder, and set the storefront cover.
        </p>
        <div className="mt-6">
          <PartMediaPanel
            partId={part.id}
            images={part.images.map((img) => ({
              ...img,
              isCover: img.isCover || img.url === part.coverImageUrl,
            }))}
            videos={part.videos}
          />
        </div>
      </div>

      <p className="mt-10 text-sm text-zinc-500">
        <Link href="/admin/parts?tab=catalog" className="text-[var(--brand)] hover:underline">
          ← Back to Parts Management
        </Link>
      </p>
    </div>
  );
}
