import type { PaymentSettlementMethod } from "@prisma/client";

/** Stable ordering for admin filters, intelligence, and dropdowns. */
export const SETTLEMENT_METHOD_ORDER: readonly PaymentSettlementMethod[] = [
  "PAYSTACK",
  "MOBILE_MONEY",
  "BANK_GHS_COMPANY",
  "ALIPAY_RMB",
  "CASH_OFFICE_GHS",
  "CASH_OFFICE_USD",
] as const;

/** Short labels for tables and filters */
export const SETTLEMENT_METHOD_LABEL: Record<PaymentSettlementMethod, string> = {
  PAYSTACK: "Paystack",
  MOBILE_MONEY: "Mobile Money (receipt)",
  BANK_GHS_COMPANY: "Spark bank account (GHS)",
  ALIPAY_RMB: "Alipay (RMB)",
  CASH_OFFICE_GHS: "Cash — office (GHS)",
  CASH_OFFICE_USD: "Cash — office (USD)",
};

export function settlementMethodLabel(m: PaymentSettlementMethod): string {
  return SETTLEMENT_METHOD_LABEL[m] ?? m;
}

export type SettlementInstructions = {
  title: string;
  lines: string[];
};

/** Static copy for customer + admin; replace with CMS/env in a later phase. */
export function getSettlementInstructions(method: PaymentSettlementMethod): SettlementInstructions {
  switch (method) {
    case "PAYSTACK":
      return {
        title: "Paystack",
        lines: [
          "Complete payment on Paystack (card, bank transfer, or Mobile Money where enabled).",
          "Confirmation is automatic when Paystack reports success — no screenshot required unless we ask.",
        ],
      };
    case "MOBILE_MONEY":
      return {
        title: "Mobile Money",
        lines: [
          "Send the agreed amount via Mobile Money using details provided by Spark and Drive Autos.",
          "Upload a clear screenshot of the success SMS or app receipt on your payment page.",
        ],
      };
    case "BANK_GHS_COMPANY":
      return {
        title: "Authorised company account (GHS)",
        lines: [
          "Transfer Ghana Cedis (GHS) only to the Spark and Drive Autos business account on file with your relationship manager.",
          "Use your order reference in the transfer narration when possible.",
          "Upload the bank receipt or screenshot after payment.",
        ],
      };
    case "ALIPAY_RMB":
      return {
        title: "Alipay (RMB)",
        lines: [
          "Pay in Chinese Yuan (RMB) via Alipay using the merchant details shared by our team.",
          "Confirm the exchange arrangement with us before sending — amounts on the vehicle page are shown in GHS for reference.",
          "Upload the Alipay confirmation screenshot.",
        ],
      };
    case "CASH_OFFICE_GHS":
      return {
        title: "Cash at office (GHS)",
        lines: [
          "Pay Ghana Cedis in person at our authorised office location during business hours.",
          "You will receive a receipt — upload a photo if asked for verification.",
        ],
      };
    case "CASH_OFFICE_USD":
      return {
        title: "Cash at office (USD)",
        lines: [
          "Pay US Dollars in person at our authorised office location during business hours.",
          "Confirm the USD amount with our team beforehand; upload a receipt photo if requested.",
        ],
      };
    default:
      return { title: "Payment", lines: ["Follow the instructions from our team."] };
  }
}
