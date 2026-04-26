import { ReceiptType, type ReceiptTemplate } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ReceiptScope = ReceiptType;
type ReceiptTemplateDefaultFields = {
  name: string;
  businessName: string;
  title: string;
  categoryLabel: string;
  accentColor: string;
  phone: string;
  email: string;
  address: string;
  signatureLabel: string;
  showSignatureLine: boolean;
  legalNote: string;
  footerNote: string;
  isActive: boolean;
};

export const RECEIPT_DEFAULTS: Record<ReceiptScope, ReceiptTemplateDefaultFields> = {
  CAR_PAYMENT: {
    name: "Default Car Payment",
    businessName: "Spark and Drive Autos",
    title: "Vehicle Payment Receipt",
    categoryLabel: "Car Inventory Payment",
    accentColor: "#31b6c7",
    phone: "+233 55 262 6997 / +233 26 145 5061",
    email: "sparkanddriveautos@gmail.com",
    address: "Accra, Ghana",
    signatureLabel: "Authorized Signature",
    showSignatureLine: true,
    legalNote:
      "This receipt confirms payment for the listed vehicle only. Shipping, logistics, clearing, duty, registration, sourcing charges, and related third-party costs are separate unless expressly stated in writing. This receipt is subject to Spark and Drive Gear platform terms and payment verification records.",
    footerNote: "Thank you for choosing Spark and Drive Autos.",
    isActive: true,
  },
  PARTS_PAYMENT: {
    name: "Default Parts Payment",
    businessName: "Spark and Drive Gear",
    title: "Parts & Accessories Receipt",
    categoryLabel: "Parts Payment",
    accentColor: "#ef4444",
    phone: "+233 55 262 6997 / +233 26 145 5061",
    email: "sparkanddriveautos@gmail.com",
    address: "Accra, Ghana",
    signatureLabel: "Authorized Signature",
    showSignatureLine: true,
    legalNote:
      "This receipt confirms successful payment for parts and accessories listed below. Delivery timelines, logistics, and any installation-related charges follow your order confirmation unless otherwise agreed in writing.",
    footerNote: "Thank you for shopping with Spark & Drive Gear.",
    isActive: true,
  },
  PARTS_FINDER_ACTIVATION: {
    name: "Default Parts Finder Activation",
    businessName: "Spark and Drive Gear",
    title: "Parts Finder Activation Receipt",
    categoryLabel: "Membership Activation",
    accentColor: "#ef4444",
    phone: "+233 55 262 6997 / +233 26 145 5061",
    email: "sparkanddriveautos@gmail.com",
    address: "Accra, Ghana",
    signatureLabel: "Authorized Signature",
    showSignatureLine: true,
    legalNote:
      "This receipt confirms payment for Parts Finder access. Parts Finder provides AI-assisted search guidance and does not guarantee exact fitment, OEM accuracy, or availability unless verified by Spark and Drive Gear.",
    footerNote: "Thank you for activating Parts Finder.",
    isActive: true,
  },
  SOURCING_DEPOSIT: {
    name: "Default Sourcing Deposit",
    businessName: "Spark and Drive Autos",
    title: "Sourcing Deposit Receipt",
    categoryLabel: "Sourcing Deposit",
    accentColor: "#f59e0b",
    phone: "+233 55 262 6997 / +233 26 145 5061",
    email: "sparkanddriveautos@gmail.com",
    address: "Accra, Ghana",
    signatureLabel: "Authorized Signature",
    showSignatureLine: true,
    legalNote:
      "This receipt confirms receipt of a sourcing deposit or related sourcing payment. Sourcing remains subject to supplier availability, customer approval, third-party costs, and the active sourcing agreement.",
    footerNote: "Thank you for trusting our sourcing team.",
    isActive: true,
  },
  WALLET_TOPUP: {
    name: "Default Wallet Topup",
    businessName: "Spark and Drive Autos",
    title: "Wallet Top-Up Receipt",
    categoryLabel: "Wallet Credit",
    accentColor: "#10b981",
    phone: "+233 55 262 6997 / +233 26 145 5061",
    email: "sparkanddriveautos@gmail.com",
    address: "Accra, Ghana",
    signatureLabel: "Authorized Signature",
    showSignatureLine: false,
    legalNote:
      "This receipt confirms wallet credit only. Use of wallet balance remains subject to order validation, verification checks, and applicable Spark and Drive platform policies.",
    footerNote: "Your wallet has been credited successfully.",
    isActive: true,
  },
  MANUAL_PAYMENT: {
    name: "Default Manual Payment",
    businessName: "Spark and Drive Autos",
    title: "Manual Payment Receipt",
    categoryLabel: "Manual/Offline Payment",
    accentColor: "#6366f1",
    phone: "+233 55 262 6997 / +233 26 145 5061",
    email: "sparkanddriveautos@gmail.com",
    address: "Accra, Ghana",
    signatureLabel: "Authorized Signature",
    showSignatureLine: true,
    legalNote:
      "This receipt records a manual/offline payment as verified by Spark and Drive. Receipt validity remains tied to successful internal payment verification records and platform legal policies.",
    footerNote: "Thank you for your payment.",
    isActive: true,
  },
  VERIFIED_PART_REQUEST: {
    name: "Default Verified Part Request",
    businessName: "Spark and Drive Gear",
    title: "Verified Part Request Receipt",
    categoryLabel: "Verification Service",
    accentColor: "#22c55e",
    phone: "+233 55 262 6997 / +233 26 145 5061",
    email: "sparkanddriveautos@gmail.com",
    address: "Accra, Ghana",
    signatureLabel: "Authorized Signature",
    showSignatureLine: true,
    legalNote:
      "This receipt confirms payment for Spark & Drive Verified Part Request service. The fee covers fitment verification and sourcing support only. Final part availability, supplier price, delivery cost, duty, logistics, and installation are separate unless expressly stated.",
    footerNote: "Thank you for using Verified Part Request.",
    isActive: true,
  },
};

export async function getActiveReceiptTemplate(type: ReceiptScope): Promise<ReceiptTemplate> {
  const active = await prisma.receiptTemplate.findFirst({
    where: { type, isActive: true },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });
  if (active) return active;
  return prisma.receiptTemplate.create({
    data: {
      type,
      version: 1,
      ...RECEIPT_DEFAULTS[type],
    },
  });
}

export async function getReceiptTemplatesByType(type: ReceiptScope) {
  return prisma.receiptTemplate.findMany({
    where: { type },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
  });
}
