import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BASE = "/dashboard/inquiry-requests";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readPage(sp: Record<string, string | string[] | undefined>, key: string): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

const INQUIRY_PAGE_SIZE = 10;
const REQUEST_PAGE_SIZE = 10;

function querySuffix(sp: URLSearchParams): string {
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export default async function DashboardInquiryRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect(BASE);
  const sp = await searchParams;
  const inquiryPageReq = readPage(sp, "page");
  const carPageReq = readPage(sp, "carPage");
  const partPageReq = readPage(sp, "partPage");

  const [inquiryTotal, carTotal, partTotal] = await Promise.all([
    prisma.inquiry.count({ where: { userId: session.user.id } }),
    prisma.carRequest.count({ where: { userId: session.user.id } }),
    prisma.partSourcingRequest.count({ where: { userId: session.user.id } }),
  ]);

  const inquiryTotalPages = Math.max(1, Math.ceil(Math.max(0, inquiryTotal) / INQUIRY_PAGE_SIZE));
  const carTotalPages = Math.max(1, Math.ceil(Math.max(0, carTotal) / REQUEST_PAGE_SIZE));
  const partTotalPages = Math.max(1, Math.ceil(Math.max(0, partTotal) / REQUEST_PAGE_SIZE));

  const inquiryPage = Math.min(Math.max(1, inquiryPageReq), inquiryTotalPages);
  const carPage = Math.min(Math.max(1, carPageReq), carTotalPages);
  const partPage = Math.min(Math.max(1, partPageReq), partTotalPages);

  const [inquiryRows, carRows, partRows] = await Promise.all([
    prisma.inquiry.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (inquiryPage - 1) * INQUIRY_PAGE_SIZE,
      take: INQUIRY_PAGE_SIZE,
      include: {
        car: { select: { title: true, slug: true } },
        threads: { take: 1, select: { id: true } },
      },
    }),
    prisma.carRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (carPage - 1) * REQUEST_PAGE_SIZE,
      take: REQUEST_PAGE_SIZE,
    }),
    prisma.partSourcingRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip: (partPage - 1) * REQUEST_PAGE_SIZE,
      take: REQUEST_PAGE_SIZE,
    }),
  ]);

  const commonQ = () => {
    const p = new URLSearchParams();
    if (carPage > 1) p.set("carPage", String(carPage));
    if (partPage > 1) p.set("partPage", String(partPage));
    return p;
  };

  const inquiryPageHref = (next: number) => {
    const p = commonQ();
    if (next > 1) p.set("page", String(next));
    return `${BASE}${querySuffix(p)}#inquiries`;
  };

  const requestsHref = (next: { carPage?: number; partPage?: number }) => {
    const p = new URLSearchParams();
    if (inquiryPage > 1) p.set("page", String(inquiryPage));
    const c = next.carPage ?? carPage;
    const pt = next.partPage ?? partPage;
    if (c > 1) p.set("carPage", String(c));
    if (pt > 1) p.set("partPage", String(pt));
    return `${BASE}${querySuffix(p)}#sourcing`;
  };

  return (
    <div>
      <PageHeading variant="dashboard">Customer inquiry &amp; requests</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Inquiries, vehicle sourcing, and auto parts requests in one place. Team replies also appear in{" "}
        <Link href="/dashboard/chats" className="text-[var(--brand)] hover:underline">
          messages
        </Link>{" "}
        and <Link href="/chat">Live Support</Link> where applicable. Sourcing updates are mirrored in{" "}
        <Link href="/dashboard/notifications" className="text-[var(--brand)] hover:underline">
          notifications
        </Link>
        .
      </p>

      <section id="inquiries" className="scroll-mt-6">
        <h2 className="mt-12 text-lg font-semibold text-white">Customer inquiries</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Questions and messages tied to listings or general support.
        </p>
        <ul className="mt-6 space-y-3">
          {inquiryRows.length === 0 ? (
            <li className="text-sm text-zinc-500">No inquiries yet.</li>
          ) : (
            inquiryRows.map((r) => (
              <li key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                <p className="font-medium text-white">{r.type.replaceAll("_", " ")}</p>
                <p className="mt-2 text-zinc-400 line-clamp-3">{r.message}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {r.car?.title ?? "General"} · {r.status} · {r.createdAt.toLocaleString()}
                </p>
                {r.threads[0] ? (
                  <Link
                    href={`/chat?threadId=${r.threads[0].id}`}
                    className="mt-3 inline-flex text-[var(--brand)] hover:underline"
                  >
                    Continue conversation →
                  </Link>
                ) : null}
              </li>
            ))
          )}
        </ul>
        {inquiryTotal > 0 ? (
          <ListPaginationFooter
            page={inquiryPage}
            totalPages={inquiryTotalPages}
            totalItems={inquiryTotal}
            pageSize={INQUIRY_PAGE_SIZE}
            itemLabel="Inquiries"
            prevHref={inquiryPage > 1 ? inquiryPageHref(inquiryPage - 1) : null}
            nextHref={inquiryPage < inquiryTotalPages ? inquiryPageHref(inquiryPage + 1) : null}
          />
        ) : null}
      </section>

      <section id="sourcing" className="scroll-mt-6">
        <h2 className="mt-12 text-lg font-semibold text-white">Vehicle sourcing</h2>
        <p className="mt-2 text-sm text-zinc-500">Request-a-car submissions and their status.</p>
        <div className="mt-4 space-y-3">
          {carRows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No vehicle requests yet.{" "}
              <Link href="/request-a-car" className="text-[var(--brand)] hover:underline">
                Request a car
              </Link>
            </p>
          ) : (
            carRows.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-300"
              >
                <p className="font-medium text-white">
                  {r.brand} {r.model}
                  {r.yearFrom || r.yearTo ? (
                    <span className="text-zinc-500">
                      {" "}
                      ({r.yearFrom ?? "?"}–{r.yearTo ?? "?"})
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {r.status} · {r.createdAt.toLocaleString()}
                </p>
                {r.notes ? <p className="mt-2 text-zinc-400">{r.notes}</p> : null}
              </div>
            ))
          )}
        </div>
        {carTotal > 0 ? (
          <ListPaginationFooter
            page={carPage}
            totalPages={carTotalPages}
            totalItems={carTotal}
            pageSize={REQUEST_PAGE_SIZE}
            itemLabel="Vehicle requests"
            prevHref={carPage > 1 ? requestsHref({ carPage: carPage - 1 }) : null}
            nextHref={carPage < carTotalPages ? requestsHref({ carPage: carPage + 1 }) : null}
          />
        ) : null}

        <h2 className="mt-12 text-lg font-semibold text-white">AutoParts &amp; accessories</h2>
        <p className="mt-2 text-sm text-zinc-500">Sourcing requests from the autparts form or catalog follow-ups.</p>
        <div className="mt-4 space-y-3">
          {partRows.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No parts requests yet.{" "}
              <Link href="/request-autoparts" className="text-[var(--brand)] hover:underline">
                Request AutoParts or Accessories
              </Link>{" "}
              (signed in) or{" "}
              <Link href="/parts" className="text-[var(--brand)] hover:underline">
                browse the catalog
              </Link>
              .
            </p>
          ) : (
            partRows.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-300"
              >
                <p className="font-medium text-white">
                  {r.summaryTitle?.trim() || "Parts / accessories request"}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {r.status}
                  {r.quantity > 1 ? ` · qty ${r.quantity}` : ""}
                  {r.urgency ? ` · ${r.urgency}` : ""} · {r.createdAt.toLocaleString()}
                </p>
                <p className="mt-2 line-clamp-4 text-zinc-400">{r.description}</p>
                {r.imageUrls.length > 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">{r.imageUrls.length} reference image(s) on file</p>
                ) : null}
              </div>
            ))
          )}
        </div>
        {partTotal > 0 ? (
          <ListPaginationFooter
            page={partPage}
            totalPages={partTotalPages}
            totalItems={partTotal}
            pageSize={REQUEST_PAGE_SIZE}
            itemLabel="AutoParts requests"
            prevHref={partPage > 1 ? requestsHref({ partPage: partPage - 1 }) : null}
            nextHref={partPage < partTotalPages ? requestsHref({ partPage: partPage + 1 }) : null}
          />
        ) : null}
      </section>
    </div>
  );
}
