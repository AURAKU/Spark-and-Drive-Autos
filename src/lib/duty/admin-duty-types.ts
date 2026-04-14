import type { DutyWorkflowStage } from "@prisma/client";

export type AdminDutyOrderRow = {
  id: string;
  reference: string;
  orderStatus: string;
  userEmail: string | null;
  carTitle: string | null;
  carSlug: string | null;
  carYear: number | null;
  basePriceRmb: number | null;
  currency: string;
  /** Vehicle order total in GHS — rough proxy for calculator pre-fill (not CIF). */
  orderAmountGhs: number;
  seaShipment: { id: string; currentStage: string } | null;
  duty: {
    id: string;
    workflowStage: DutyWorkflowStage;
    estimateTotalGhs: number | null;
    assessedDutyGhs: number | null;
    customerVisibleNote: string | null;
    internalNote: string | null;
    dutyAmount: number | null;
    formulaVersion: string | null;
  } | null;
  dutyPayments: Array<{ id: string; status: string; amount: number; currency: string }>;
};
