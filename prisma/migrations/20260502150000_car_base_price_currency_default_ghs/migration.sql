-- New vehicle rows default list-price currency to GHS (matches admin UI). Existing rows unchanged.
ALTER TABLE "Car" ALTER COLUMN "basePriceCurrency" SET DEFAULT 'GHS';
