-- CreateIndex
CREATE INDEX "CarRequest_userId_idx" ON "CarRequest"("userId");

-- CreateIndex
CREATE INDEX "Inquiry_userId_idx" ON "Inquiry"("userId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_ghanaCardVerificationStatus_idx" ON "User"("ghanaCardVerificationStatus");

-- CreateIndex
CREATE INDEX "User_ghanaCardVerificationStatus_updatedAt_idx" ON "User"("ghanaCardVerificationStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "User_ghanaCardVerificationStatus_ghanaCardExpiresAt_idx" ON "User"("ghanaCardVerificationStatus", "ghanaCardExpiresAt");

