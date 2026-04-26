import { Prisma } from "@prisma/client";

const MAX_Q = 200;

export function normalizeOrderListSearchQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_Q);
}

/**
 * Case-insensitive match on reference, item titles (car / line snapshots), customer
 * (email, name, phone), order notes, receipt ref, exact order amount when `q` is numeric.
 */
export function buildOrderListSearchWhere(q: string): Prisma.OrderWhereInput | null {
  if (q.length === 0) return null;

  const or: Prisma.OrderWhereInput[] = [
    { reference: { contains: q, mode: "insensitive" } },
    { car: { is: { title: { contains: q, mode: "insensitive" } } } },
    { partItems: { some: { titleSnapshot: { contains: q, mode: "insensitive" } } } },
    {
      user: {
        is: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { country: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    },
    { notes: { contains: q, mode: "insensitive" } },
  ];

  if (q.length >= 2) {
    or.push({ receiptReference: { contains: q, mode: "insensitive" } });
  }

  if (/^c[a-z0-9]{20,30}$/i.test(q)) {
    or.push({ id: q });
  }

  const amountEq = tryParseOrderAmountForSearch(q);
  if (amountEq != null) {
    or.push({ amount: { equals: amountEq } });
  }

  return { OR: or };
}

function tryParseOrderAmountForSearch(q: string): Prisma.Decimal | null {
  const t = q.replace(/,/g, "").replace(/\s/g, "");
  if (t.length === 0) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000_000) return null;
  return new Prisma.Decimal(t);
}
