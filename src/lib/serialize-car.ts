import type { Car, CarImage, CarVideo } from "@prisma/client";

/** `Car` with Prisma `Decimal` fields converted to numbers for client components. */
export type CarForClientEdit = Omit<
  Car,
  | "basePriceRmb"
  | "basePriceAmount"
  | "price"
  | "supplierCostRmb"
  | "supplierCostAmount"
  | "seaShippingFeeGhs"
  | "reservationDepositPercent"
> & {
  basePriceRmb: number;
  basePriceAmount: number;
  basePriceCurrency: string;
  price: number;
  supplierCostRmb: number | null;
  supplierCostAmount: number | null;
  supplierCostCurrency: string | null;
  seaShippingFeeGhs: number | null;
  reservationDepositPercent: number | null;
};

export function serializeCarForEditForm(
  car: Car & { images: CarImage[]; videos: CarVideo[] },
): CarForClientEdit & { images: CarImage[]; videos: CarVideo[] } {
  return {
    ...car,
    basePriceRmb: Number(car.basePriceRmb),
    basePriceAmount: Number(car.basePriceAmount),
    basePriceCurrency: car.basePriceCurrency,
    price: Number(car.price),
    supplierCostRmb: car.supplierCostRmb != null ? Number(car.supplierCostRmb) : null,
    supplierCostAmount: car.supplierCostAmount != null ? Number(car.supplierCostAmount) : null,
    supplierCostCurrency: car.supplierCostCurrency ?? null,
    seaShippingFeeGhs: car.seaShippingFeeGhs != null ? Number(car.seaShippingFeeGhs) : null,
    reservationDepositPercent:
      car.reservationDepositPercent != null ? Number(car.reservationDepositPercent) : null,
  };
}
