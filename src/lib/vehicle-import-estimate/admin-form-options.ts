import { OrderKind, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const LINK_LIST_TAKE = 400;

const userSelect = { id: true, name: true, email: true } satisfies Prisma.UserSelect;
const orderSelect = {
  id: true,
  reference: true,
  user: { select: { name: true, email: true } },
  car: { select: { title: true } },
} satisfies Prisma.OrderSelect;
const inquirySelect = {
  id: true,
  message: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.InquirySelect;
const carSelect = { id: true, title: true, year: true, engineType: true } satisfies Prisma.CarSelect;

export type AdminEstimateFormUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;
export type AdminEstimateFormOrder = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;
export type AdminEstimateFormInquiry = Prisma.InquiryGetPayload<{ select: typeof inquirySelect }>;
export type AdminEstimateFormCar = Prisma.CarGetPayload<{ select: typeof carSelect }>;

async function mergeById<T extends { id: string }>(
  rows: T[],
  id: string | null | undefined,
  fetchOne: (id: string) => Promise<T | null>,
): Promise<T[]> {
  if (!id || !id.trim()) return rows;
  if (rows.some((r) => r.id === id)) return rows;
  const one = await fetchOne(id);
  return one ? [one, ...rows] : rows;
}

export type VehicleImportEstimateLinkEnsures = {
  userId?: string | null;
  orderId?: string | null;
  inquiryId?: string | null;
  carId?: string | null;
};

/**
 * Users, CAR-kind orders, inquiries, and cars for duty estimate link fields.
 * Ensures the currently linked ids are present even if outside the recent `take` window.
 */
export async function fetchVehicleImportEstimateFormLinkOptions(
  ensures: VehicleImportEstimateLinkEnsures = {},
): Promise<{
  users: AdminEstimateFormUser[];
  orders: AdminEstimateFormOrder[];
  inquiries: AdminEstimateFormInquiry[];
  cars: AdminEstimateFormCar[];
}> {
  const [users, orders, inquiries, cars] = await Promise.all([
    prisma.user.findMany({
      orderBy: { updatedAt: "desc" },
      take: LINK_LIST_TAKE,
      select: userSelect,
    }),
    prisma.order.findMany({
      where: { kind: OrderKind.CAR },
      orderBy: { updatedAt: "desc" },
      take: LINK_LIST_TAKE,
      select: orderSelect,
    }),
    prisma.inquiry.findMany({
      orderBy: { updatedAt: "desc" },
      take: LINK_LIST_TAKE,
      select: inquirySelect,
    }),
    prisma.car.findMany({
      orderBy: { updatedAt: "desc" },
      take: LINK_LIST_TAKE,
      select: carSelect,
    }),
  ]);

  const [mergedUsers, mergedOrders, mergedInquiries, mergedCars] = await Promise.all([
    mergeById(users, ensures.userId, (id) => prisma.user.findUnique({ where: { id }, select: userSelect })),
    mergeById(orders, ensures.orderId, (id) => prisma.order.findUnique({ where: { id }, select: orderSelect })),
    mergeById(inquiries, ensures.inquiryId, (id) => prisma.inquiry.findUnique({ where: { id }, select: inquirySelect })),
    mergeById(cars, ensures.carId, (id) => prisma.car.findUnique({ where: { id }, select: carSelect })),
  ]);

  return {
    users: mergedUsers,
    orders: mergedOrders,
    inquiries: mergedInquiries,
    cars: mergedCars,
  };
}
