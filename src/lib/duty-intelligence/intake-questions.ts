import { isElectricFuelType, isIceFuelType, type MinimumIntakeInput } from "./intake-schema";

export type IntakeQuestionId =
  | "make"
  | "model"
  | "year"
  | "fuelType"
  | "fobAmount"
  | "fobCurrency"
  | "manufactureMonth"
  | "engineCc"
  | "powerKw"
  | "vehicleCategory"
  | "freight"
  | "insurance"
  | "hsCode"
  | "vin"
  | "seats"
  | "weight"
  | "countryOfOrigin";

export type IntakeQuestion = {
  id: IntakeQuestionId;
  required: boolean;
  reason: string;
  inferred?: boolean;
  inferredValue?: string | number;
};

export type IntakeQuestionContext = {
  input: Partial<MinimumIntakeInput>;
  expertMode?: boolean;
  hasShippingConfig?: boolean;
  hasInsuranceConfig?: boolean;
  modelLookupUncertain?: boolean;
  needsDepreciation?: boolean;
  classificationUnresolved?: boolean;
  inferredFromInventory?: boolean;
};

const ALWAYS: IntakeQuestion[] = [
  { id: "make", required: true, reason: "Identifies the vehicle for duty classification" },
  { id: "model", required: true, reason: "Matches verified import profiles" },
  { id: "year", required: true, reason: "Vehicle age affects applicable rules" },
  { id: "fuelType", required: true, reason: "Fuel type determines HS profile and duty rates" },
  { id: "fobAmount", required: true, reason: "Purchase value is the basis for customs valuation" },
  { id: "fobCurrency", required: true, reason: "Currency conversion uses assessment-date FX" },
];

export function resolveIntakeQuestions(ctx: IntakeQuestionContext): IntakeQuestion[] {
  const questions: IntakeQuestion[] = [...ALWAYS];
  const vehicle = ctx.input.vehicle;
  const fuelType = vehicle?.fuelType;

  if (ctx.needsDepreciation) {
    questions.push({
      id: "manufactureMonth",
      required: false,
      reason: "Manufacture month refines vehicle age for depreciation-sensitive profiles",
    });
  }

  if (fuelType && isIceFuelType(fuelType)) {
    questions.push({
      id: "engineCc",
      required: true,
      reason: "Engine capacity determines HS subheading for combustion vehicles",
      inferred: Boolean(vehicle?.engineCc),
      inferredValue: vehicle?.engineCc,
    });
  }

  if (fuelType && isElectricFuelType(fuelType)) {
    questions.push({
      id: "powerKw",
      required: !vehicle?.engineCc,
      reason: "Electric power output helps resolve EV duty profiles",
      inferred: Boolean(vehicle?.powerKw),
      inferredValue: vehicle?.powerKw,
    });
  }

  if (ctx.modelLookupUncertain || !vehicle?.vehicleCategory) {
    questions.push({
      id: "vehicleCategory",
      required: ctx.modelLookupUncertain === true,
      reason: "Vehicle category affects freight estimates and HS inference",
      inferred: Boolean(vehicle?.vehicleCategory),
      inferredValue: vehicle?.vehicleCategory,
    });
  }

  if (!ctx.hasShippingConfig && !ctx.input.shipping?.freightGhsOverride) {
    questions.push({
      id: "freight",
      required: false,
      reason: "Freight is not available from shipping configuration for this route",
    });
  }

  if (!ctx.hasInsuranceConfig && !ctx.input.shipping?.insuranceGhsOverride) {
    questions.push({
      id: "insurance",
      required: false,
      reason: "Insurance could not be derived from configured rules",
    });
  }

  if (ctx.classificationUnresolved && ctx.expertMode) {
    questions.push({
      id: "hsCode",
      required: true,
      reason: "HS code is required when automatic classification is uncertain (expert mode)",
    });
  }

  questions.push({
    id: "vin",
    required: false,
    reason: "VIN can decode specifications and improve classification confidence",
  });

  if (ctx.classificationUnresolved) {
    questions.push(
      {
        id: "seats",
        required: false,
        reason: "Seating capacity may distinguish passenger vs commercial profiles",
      },
      {
        id: "weight",
        required: false,
        reason: "Gross weight may be required for certain commercial classifications",
      },
    );
  }

  if (!vehicle?.countryOfOrigin && !ctx.inferredFromInventory) {
    questions.push({
      id: "countryOfOrigin",
      required: false,
      reason: "Country of export affects freight and insurance assumptions",
      inferred: false,
    });
  }

  return questions;
}

export function requiredQuestionIds(questions: IntakeQuestion[]): IntakeQuestionId[] {
  return questions.filter((q) => q.required).map((q) => q.id);
}
