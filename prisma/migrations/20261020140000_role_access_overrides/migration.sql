-- Additive: staff role admin-page grants editable by Super Admin. No user data rewritten.
CREATE TABLE IF NOT EXISTS "RoleAccessOverride" (
  "id" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "pageKeys" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  CONSTRAINT "RoleAccessOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoleAccessOverride_role_key" ON "RoleAccessOverride"("role");
CREATE INDEX IF NOT EXISTS "RoleAccessOverride_updatedById_idx" ON "RoleAccessOverride"("updatedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RoleAccessOverride_updatedById_fkey'
  ) THEN
    ALTER TABLE "RoleAccessOverride"
      ADD CONSTRAINT "RoleAccessOverride_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
