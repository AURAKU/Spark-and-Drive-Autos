-- Site-wide default % for vehicle reservation deposit when per-car % is not set.
ALTER TABLE "GlobalCurrencySettings" ADD COLUMN IF NOT EXISTS "defaultReservationDepositPercent" DECIMAL(5,2) NOT NULL DEFAULT 5;
