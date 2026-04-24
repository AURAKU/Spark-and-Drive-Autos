import Link from "next/link";
import { notFound } from "next/navigation";

import { CarMediaPanel } from "@/components/admin/car-media-panel";
import { PageHeading } from "@/components/typography/page-headings";
import { prisma } from "@/lib/prisma";
import { serializeCarForEditForm } from "@/lib/serialize-car";
import { carHasSuccessfulFullVehiclePayment } from "@/lib/sold-vehicle";

import { EditCarForm } from "./edit-car-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditCarPage(props: Props) {
  const { id } = await props.params;
  const car = await prisma.car.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      videos: { orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }] },
    },
  });
  if (!car) notFound();

  const carForClient = serializeCarForEditForm(car);
  const hasSuccessfulFullPayment = await carHasSuccessfulFullVehiclePayment(car.id);

  return (
    <div>
      <PageHeading variant="dashboard">Edit vehicle</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Listing: <span className="font-mono text-zinc-200">{car.slug}</span> ·{" "}
        <Link className="text-[var(--brand)] hover:underline" href={`/cars/${car.slug}`}>
          View public page
        </Link>
      </p>
      <EditCarForm car={carForClient} hasSuccessfulFullPayment={hasSuccessfulFullPayment} />
      <div className="mt-12 border-t border-white/10 pt-10">
        <h2 className="text-lg font-semibold text-white">Photos &amp; video</h2>
        <p className="mt-1 text-sm text-zinc-500">Manage gallery order, cover image, and walkthrough clips.</p>
        <div className="mt-6">
          <CarMediaPanel carId={car.id} images={car.images} videos={car.videos} />
        </div>
      </div>
    </div>
  );
}
