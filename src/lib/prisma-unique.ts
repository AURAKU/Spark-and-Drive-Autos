import { Prisma } from "@prisma/client";

/** True when Prisma rejected a row because of a unique constraint (PostgreSQL 23505). */
export function isUniqueConstraintViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
