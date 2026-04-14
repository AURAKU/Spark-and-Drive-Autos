-- Lead source for parts sourcing requests
ALTER TYPE "LeadSourceChannel" ADD VALUE 'PARTS_SOURCING_REQUEST';

-- PartSourcingRequest status
CREATE TYPE "PartsRequestStatus" AS ENUM ('NEW', 'REVIEWING', 'QUOTED', 'FULFILLED', 'CLOSED');

-- Table
CREATE TABLE "PartSourcingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summaryTitle" VARCHAR(200),
    "description" TEXT NOT NULL,
    "vehicleMake" VARCHAR(80),
    "vehicleModel" VARCHAR(80),
    "vehicleYear" INTEGER,
    "partNumber" VARCHAR(120),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "urgency" VARCHAR(40),
    "deliveryCity" VARCHAR(120),
    "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "PartsRequestStatus" NOT NULL DEFAULT 'NEW',
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartSourcingRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartSourcingRequest_userId_createdAt_idx" ON "PartSourcingRequest"("userId", "createdAt");
CREATE INDEX "PartSourcingRequest_status_idx" ON "PartSourcingRequest"("status");
CREATE INDEX "PartSourcingRequest_createdAt_idx" ON "PartSourcingRequest"("createdAt");

ALTER TABLE "PartSourcingRequest" ADD CONSTRAINT "PartSourcingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartSourcingRequest" ADD CONSTRAINT "PartSourcingRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
