-- CreateEnum
CREATE TYPE "PartsFinderApprovalMode" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "PartsFinderSettings"
ADD COLUMN "approvalMode" "PartsFinderApprovalMode" NOT NULL DEFAULT 'MANUAL';
