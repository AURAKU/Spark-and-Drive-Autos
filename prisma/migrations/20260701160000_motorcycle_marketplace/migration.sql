-- Motorcycle marketplace + OrderKind extension

CREATE TYPE "MotorcycleType" AS ENUM (
  'SPORT',
  'NAKED',
  'CRUISER',
  'SCOOTER',
  'ADVENTURE',
  'TOURING',
  'DIRT',
  'DELIVERY',
  'ELECTRIC_BIKE',
  'E_BICYCLE',
  'ATV',
  'OTHER'
);

ALTER TYPE "OrderKind" ADD VALUE 'MOTORCYCLE';

CREATE TABLE "Motorcycle" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "variant" TEXT,
  "motorcycleType" "MotorcycleType" NOT NULL,
  "engineType" "EngineType" NOT NULL,
  "transmission" TEXT,
  "driveType" TEXT,
  "mileage" INTEGER,
  "color" TEXT,
  "vin" TEXT,
  "frameNumber" TEXT,
  "engineNumber" TEXT,
  "engineCc" INTEGER,
  "condition" TEXT,
  "sourceType" "SourceType" NOT NULL,
  "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
  "inspectionStatus" TEXT,
  "estimatedDelivery" TEXT,
  "seaShippingFeeGhs" DECIMAL(14,2),
  "reservationDepositPercent" DECIMAL(5,2),
  "basePriceAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "basePriceCurrency" VARCHAR(3) NOT NULL DEFAULT 'GHS',
  "basePriceRmb" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "supplierCostAmount" DECIMAL(14,2),
  "supplierCostCurrency" VARCHAR(3),
  "supplierCostRmb" DECIMAL(14,2),
  "supplierDealerName" VARCHAR(200),
  "supplierDealerPhone" VARCHAR(40),
  "supplierDealerReference" TEXT,
  "supplierDealerNotes" TEXT,
  "price" DECIMAL(14,2) NOT NULL,
  "priceGhs" DECIMAL(14,2),
  "priceUsd" DECIMAL(14,2),
  "priceCny" DECIMAL(14,2),
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "location" TEXT,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "listingState" "CarListingState" NOT NULL DEFAULT 'DRAFT',
  "featureTags" JSONB,
  "highlightTags" JSONB,
  "shortDescription" TEXT,
  "longDescription" TEXT,
  "accidentHistory" TEXT,
  "warranty" TEXT,
  "specificationsText" TEXT,
  "batteryCapacity" TEXT,
  "motorPower" TEXT,
  "electricRange" TEXT,
  "chargingTime" TEXT,
  "topSpeedKmh" INTEGER,
  "horsepower" INTEGER,
  "torque" TEXT,
  "coolingType" TEXT,
  "fuelTankCapacity" TEXT,
  "weightKg" INTEGER,
  "seatHeight" INTEGER,
  "wheelSize" TEXT,
  "tyreSize" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "coverImageUrl" TEXT,
  "coverImagePublicId" TEXT,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Motorcycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MotorcycleImage" (
  "id" TEXT NOT NULL,
  "motorcycleId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publicId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "altText" TEXT,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MotorcycleImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MotorcycleVideo" (
  "id" TEXT NOT NULL,
  "motorcycleId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publicId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "durationSec" INTEGER,
  "thumbnailUrl" TEXT,
  "mimeType" VARCHAR(120),
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MotorcycleVideo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MotorcycleSpecification" (
  "id" TEXT NOT NULL,
  "motorcycleId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "MotorcycleSpecification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MotorcycleFavorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "motorcycleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MotorcycleFavorite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MotorcycleView" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "motorcycleId" TEXT NOT NULL,
  "sessionId" VARCHAR(64),
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MotorcycleView_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "motorcycleId" TEXT;

CREATE UNIQUE INDEX "Motorcycle_slug_key" ON "Motorcycle"("slug");
CREATE INDEX "Motorcycle_brand_model_idx" ON "Motorcycle"("brand", "model");
CREATE INDEX "Motorcycle_listingState_featured_idx" ON "Motorcycle"("listingState", "featured");
CREATE INDEX "Motorcycle_sourceType_idx" ON "Motorcycle"("sourceType");
CREATE INDEX "Motorcycle_availabilityStatus_idx" ON "Motorcycle"("availabilityStatus");
CREATE INDEX "Motorcycle_motorcycleType_idx" ON "Motorcycle"("motorcycleType");
CREATE INDEX "Motorcycle_engineType_idx" ON "Motorcycle"("engineType");

CREATE INDEX "MotorcycleImage_motorcycleId_sortOrder_idx" ON "MotorcycleImage"("motorcycleId", "sortOrder");
CREATE INDEX "MotorcycleVideo_motorcycleId_sortOrder_idx" ON "MotorcycleVideo"("motorcycleId", "sortOrder");
CREATE INDEX "MotorcycleSpecification_motorcycleId_idx" ON "MotorcycleSpecification"("motorcycleId");

CREATE UNIQUE INDEX "MotorcycleFavorite_userId_motorcycleId_key" ON "MotorcycleFavorite"("userId", "motorcycleId");
CREATE INDEX "MotorcycleFavorite_userId_idx" ON "MotorcycleFavorite"("userId");

CREATE INDEX "MotorcycleView_motorcycleId_viewedAt_idx" ON "MotorcycleView"("motorcycleId", "viewedAt");
CREATE INDEX "MotorcycleView_userId_viewedAt_idx" ON "MotorcycleView"("userId", "viewedAt");

CREATE INDEX "Order_motorcycleId_idx" ON "Order"("motorcycleId");

ALTER TABLE "MotorcycleImage" ADD CONSTRAINT "MotorcycleImage_motorcycleId_fkey" FOREIGN KEY ("motorcycleId") REFERENCES "Motorcycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MotorcycleVideo" ADD CONSTRAINT "MotorcycleVideo_motorcycleId_fkey" FOREIGN KEY ("motorcycleId") REFERENCES "Motorcycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MotorcycleSpecification" ADD CONSTRAINT "MotorcycleSpecification_motorcycleId_fkey" FOREIGN KEY ("motorcycleId") REFERENCES "Motorcycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MotorcycleFavorite" ADD CONSTRAINT "MotorcycleFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MotorcycleFavorite" ADD CONSTRAINT "MotorcycleFavorite_motorcycleId_fkey" FOREIGN KEY ("motorcycleId") REFERENCES "Motorcycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MotorcycleView" ADD CONSTRAINT "MotorcycleView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MotorcycleView" ADD CONSTRAINT "MotorcycleView_motorcycleId_fkey" FOREIGN KEY ("motorcycleId") REFERENCES "Motorcycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_motorcycleId_fkey" FOREIGN KEY ("motorcycleId") REFERENCES "Motorcycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
