import { redirect } from "next/navigation";
import { DutyCalculatorWizard } from "@/components/duty/duty-calculator-wizard";
import { PageHeading } from "@/components/typography/page-headings";
import { getPublicCalculatorAccess } from "@/lib/duty-intelligence/public-access";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ carId?: string; orderId?: string }>;

export default async function DutyCalculatorPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const access = await getPublicCalculatorAccess("GH");
  if (!access.enabled) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <PageHeading variant="hero">Duty calculator unavailable</PageHeading>
        <p className="mt-4 text-muted-foreground">Please contact Spark & Drive Autos for a personalised import estimate.</p>
      </div>
    );
  }

  const session = await safeAuth();
  let prefill = undefined;

  if (sp.carId) {
    const { prisma } = await import("@/lib/prisma");
    const car = await prisma.car.findUnique({
      where: { id: sp.carId },
      select: {
        id: true,
        slug: true,
        brand: true,
        model: true,
        year: true,
        vin: true,
        engineType: true,
        bodyType: true,
        basePriceAmount: true,
        basePriceCurrency: true,
        sourceType: true,
      },
    });
    if (car) {
      prefill = {
        carId: car.id,
        slug: car.slug,
        manufacturer: car.brand,
        model: car.model,
        year: car.year,
        vin: car.vin ?? undefined,
        fuelType: car.engineType,
        fobAmount: Number(car.basePriceAmount) > 0 ? Number(car.basePriceAmount) : undefined,
        fobCurrency: car.basePriceCurrency || "USD",
        countryOfOrigin: car.sourceType === "IN_CHINA" ? "CHINA" : "CHINA",
        vehicleCategory: car.bodyType ?? "SUV",
        orderId: sp.orderId,
      };
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:py-14">
      <PageHeading variant="hero">Ghana import duty calculator</PageHeading>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Plan your landed cost with transparent assumptions. Every result is an estimate — final assessment is by Ghana Customs.
      </p>
      <div className="mt-8">
        <DutyCalculatorWizard prefill={prefill} disclaimer={access.disclaimer} isAuthenticated={Boolean(session?.user)} />
      </div>
    </div>
  );
}
