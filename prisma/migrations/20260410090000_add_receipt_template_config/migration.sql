-- Receipt templates editable by admin (car + parts)

-- CreateEnum
CREATE TYPE "ReceiptTemplateScope" AS ENUM ('CAR', 'PARTS');

-- CreateTable
CREATE TABLE "ReceiptTemplateConfig" (
    "id" TEXT NOT NULL,
    "scope" "ReceiptTemplateScope" NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT 'Spark and Drive Autos',
    "heading" TEXT NOT NULL DEFAULT 'Official Payment Receipt',
    "subheading" TEXT NOT NULL DEFAULT 'Payment confirmation',
    "contactPhone" TEXT NOT NULL DEFAULT '+233 55 262 6997 / +233 26 145 5061',
    "contactEmail" TEXT NOT NULL DEFAULT 'sparkanddriveautos@gmail.com',
    "officeAddress" TEXT NOT NULL DEFAULT 'Accra, Ghana',
    "disclaimer" TEXT NOT NULL DEFAULT 'This receipt confirms payment for the listed item(s). Shipping, logistics, clearing, duty, registration, and related charges may be separate unless agreed in writing.',
    "thankYouNote" TEXT NOT NULL DEFAULT 'Thank you for choosing Spark and Drive Autos.',
    "signatureLabel" TEXT NOT NULL DEFAULT 'Authorized Signature',
    "accentColor" TEXT NOT NULL DEFAULT '#31b6c7',
    "showSignature" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptTemplateConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptTemplateConfig_scope_key" ON "ReceiptTemplateConfig"("scope");
