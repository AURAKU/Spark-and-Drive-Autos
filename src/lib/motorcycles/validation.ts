import { z } from "zod";
import {
  AvailabilityStatus,
  CarListingState,
  EngineType,
  MotorcycleType,
  SourceType,
} from "@prisma/client";

const optionalStr = (max: number) =>
  z.preprocess((v) => (v === "" || v === undefined || v === null ? undefined : v), z.string().max(max).optional());

const optionalInt = z.preprocess((v) => {
  if (v === "" || v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}, z.number().int().optional());

const optionalPositiveInt = z.preprocess((v) => {
  if (v === "" || v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}, z.number().int().positive().optional());

const optionalNonNegInt = z.preprocess((v) => {
  if (v === "" || v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}, z.number().int().nonnegative().optional());

const optionalBool = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (v === true || v === "true" || v === "on" || v === "1") return true;
  if (v === false || v === "false" || v === "0") return false;
  return undefined;
}, z.boolean().optional());

const vehicleCurrencySchema = z.enum(["GHS", "USD", "CNY"]);

export const motorcycleCoreSchema = z.object({
  brand: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.coerce.number().int().min(1980).max(2035),
  basePriceAmount: z.coerce.number().positive(),
  basePriceCurrency: vehicleCurrencySchema,
  engineType: z.nativeEnum(EngineType),
  motorcycleType: z.nativeEnum(MotorcycleType),
  mileage: z.coerce.number().int().nonnegative(),
  condition: z.string().min(1).max(120),
  sourceType: z.nativeEnum(SourceType),
  longDescription: z.string().min(10).max(20000),
  variant: optionalStr(120),
  transmission: optionalStr(80),
  driveType: optionalStr(80),
  color: optionalStr(80),
  location: optionalStr(120),
  vin: optionalStr(32),
  frameNumber: optionalStr(64),
  engineNumber: optionalStr(64),
  engineCc: optionalPositiveInt,
  inspectionStatus: optionalStr(120),
  estimatedDelivery: optionalStr(120),
  reservationDepositPercent: z.preprocess((v) => {
    if (v === "" || v === undefined || v === null) return 80;
    const n = Number(v);
    return Number.isFinite(n) ? n : 80;
  }, z.number().gt(0).lte(100).default(80)),
  seaShippingFeeGhs: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().nonnegative().optional()),
  specificationsText: optionalStr(20000),
  specificationsJson: optionalStr(200_000),
  featureTags: z.string().optional(),
  highlightTags: z.string().optional(),
  warranty: optionalStr(500),
  batteryCapacity: optionalStr(80),
  motorPower: optionalStr(80),
  electricRange: optionalStr(80),
  chargingTime: optionalStr(80),
  topSpeedKmh: optionalPositiveInt,
  horsepower: optionalPositiveInt,
  torque: optionalStr(80),
  coolingType: optionalStr(80),
  fuelTankCapacity: optionalStr(80),
  weightKg: optionalPositiveInt,
  seatHeight: optionalPositiveInt,
  wheelSize: optionalStr(40),
  tyreSize: optionalStr(40),
  cylinders: optionalPositiveInt,
  gears: optionalPositiveInt,
  clutchType: optionalStr(80),
  absEquipped: optionalBool,
  tractionControl: optionalBool,
  lengthMm: optionalPositiveInt,
  widthMm: optionalPositiveInt,
  heightMm: optionalPositiveInt,
  wheelbaseMm: optionalPositiveInt,
  groundClearanceMm: optionalPositiveInt,
  frontTyre: optionalStr(80),
  rearTyre: optionalStr(80),
  frontBrake: optionalStr(120),
  rearBrake: optionalStr(120),
  frontSuspension: optionalStr(120),
  rearSuspension: optionalStr(120),
  manufactureDate: optionalStr(40),
  previousOwners: optionalNonNegInt,
  registrationStatus: optionalStr(120),
  knownIssues: optionalStr(5000),
  serviceHistory: optionalStr(5000),
  sellingPoints: optionalStr(5000),
  adminNotes: optionalStr(5000),
  shortDescription: optionalStr(500),
  seoTitle: optionalStr(200),
  seoDescription: optionalStr(500),
  listingState: z.nativeEnum(CarListingState).default(CarListingState.DRAFT),
  availabilityStatus: z.nativeEnum(AvailabilityStatus).optional(),
  featured: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).optional().default(false),
  coverImageUrl: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.union([z.string().url(), z.undefined()]).optional(),
  ),
  coverImagePublicId: optionalStr(200),
  supplierDealerName: optionalStr(200),
  supplierDealerPhone: optionalStr(40),
  supplierDealerReference: optionalStr(500),
  supplierDealerNotes: optionalStr(2000),
  supplierCostAmount: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().positive().optional()),
  supplierCostCurrency: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    vehicleCurrencySchema.optional(),
  ),
  /** Client-sent version for optimistic concurrency (edit only). */
  expectedVersion: optionalInt,
});

export const motorcycleCreateSchema = motorcycleCoreSchema;

export const motorcycleUpdateSchema = motorcycleCoreSchema.extend({
  id: z.string().cuid(),
  slug: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().min(3).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  ),
});

export type MotorcycleCreateInput = z.infer<typeof motorcycleCreateSchema>;
export type MotorcycleUpdateInput = z.infer<typeof motorcycleUpdateSchema>;
