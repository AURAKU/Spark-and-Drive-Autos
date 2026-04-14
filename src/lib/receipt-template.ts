import { ReceiptTemplateScope, type Prisma, type ReceiptTemplateConfig } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ReceiptScope = ReceiptTemplateScope;

export const RECEIPT_DEFAULTS: Record<ReceiptScope, Omit<Prisma.ReceiptTemplateConfigCreateInput, "scope">> = {
  CAR: {
    companyName: "Spark and Drive Autos",
    heading: "Official Vehicle Deposit Receipt",
    subheading: "Vehicle inventory payment",
    contactPhone: "+233 55 262 6997 / +233 26 145 5061",
    contactEmail: "sparkanddriveautos@gmail.com",
    officeAddress: "Accra, Ghana",
    disclaimer:
      "This receipt confirms part payment for the above vehicle. The stated amounts relate to the cost of the car only. Shipping, logistics, clearing, duty, registration, and any related charges are separate unless otherwise agreed in writing.",
    thankYouNote: "Thank you for choosing Spark and Drive Autos.",
    signatureLabel: "Authorized Signature",
    accentColor: "#31b6c7",
    showSignature: true,
  },
  PARTS: {
    companyName: "Spark and Drive Autos",
    heading: "Official Parts & Accessories Receipt",
    subheading: "Parts and accessories payment",
    contactPhone: "+233 55 262 6997 / +233 26 145 5061",
    contactEmail: "sparkanddriveautos@gmail.com",
    officeAddress: "Accra, Ghana",
    disclaimer:
      "This receipt confirms successful payment for parts and accessories listed below. Delivery timelines, logistics, and any installation-related charges follow your order confirmation unless otherwise agreed in writing.",
    thankYouNote: "Thank you for shopping with Spark & Drive Gear Auto Parts.",
    signatureLabel: "Authorized Signature",
    accentColor: "#ef4444",
    showSignature: true,
  },
};

export async function getReceiptTemplate(scope: ReceiptScope): Promise<ReceiptTemplateConfig> {
  const defaults = RECEIPT_DEFAULTS[scope];
  return prisma.receiptTemplateConfig.upsert({
    where: { scope },
    update: {},
    create: { scope, ...defaults },
  });
}
