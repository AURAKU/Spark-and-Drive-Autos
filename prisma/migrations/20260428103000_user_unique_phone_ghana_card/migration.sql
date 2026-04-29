-- Enforce one account per normalized phone and per Ghana Card ID (multiple NULLs allowed).
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

CREATE UNIQUE INDEX "User_ghanaCardIdNumber_key" ON "User"("ghanaCardIdNumber");
