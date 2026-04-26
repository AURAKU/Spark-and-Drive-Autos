-- CreateTable
CREATE TABLE "SystemBackupLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileName" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SystemBackupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemBackupLog_type_createdAt_idx" ON "SystemBackupLog"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SystemBackupLog_status_createdAt_idx" ON "SystemBackupLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SystemBackupLog_createdAt_idx" ON "SystemBackupLog"("createdAt");
