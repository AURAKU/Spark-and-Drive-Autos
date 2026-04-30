import type { Car, CarImage, CarVideo } from "@prisma/client";

/** `Car` with Prisma `Decimal` fields converted to numbers for client components. */
export type CarForClientEdit = Omit<
  Car,
  "basePriceRmb" | "price" | "supplierCostRmb" | "seaShippingFeeGhs" | "reservationDepositPercent"
> & {
  basePriceRmb: number;
  price: number;
  supplierCostRmb: number | null;
  seaShippingFeeGhs: number | null;
  reservationDepositPercent: number | null;
};

export function serializeCarForEditForm(
  car: Car & { images: CarImage[]; videos: CarVideo[] },
): CarForClientEdit & { images: CarImage[]; videos: CarVideo[] } {
  return {
    ...car,
    basePriceRmb: Number(car.basePriceRmb),
    price: Number(car.price),
    supplierCostRmb: car.supplierCostRmb != null ? Number(car.supplierCostRmb) : null,
    seaShippingFeeGhs: car.seaShippingFeeGhs != null ? Number(car.seaShippingFeeGhs) : null,
    reservationDepositPercent:
      car.reservationDepositPercent != null ? Number(car.reservationDepositPercent) : null,
  };
}
