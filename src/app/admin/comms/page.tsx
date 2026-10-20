import { AdminCommsClient } from "@/components/admin/admin-comms-client";
import { PageHeading } from "@/components/typography/page-headings";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { buildListPageMeta, listPageNav, readListPage } from "@/lib/list-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 25;

const VIEWS = ["chats", "inquiry", "sourcing", "leads", "quotes", "broadcast"] as const;
type HubView = (typeof VIEWS)[number];

const threadInclude = {
  customer: { select: { id: true, name: true, email: true } },
  car: { select: { id: true, title: true, slug: true } },
  inquiry: { select: { id: true, type: true, status: true } },
} as const;

function parseView(raw: string | undefined): HubView {
  if (raw === "inquiries") return "inquiry";
  if (raw === "announcements") return "broadcast";
  if (raw === "threads") return "chats";
  if (raw && (VIEWS as readonly string[]).includes(raw)) return raw as HubView;
  return "chats";
}

export default async function LiveSupportChatPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const raw = sp.thread;
  const initialThreadId = typeof raw === "string" ? raw : null;
  const initialView = parseView(typeof sp.view === "string" ? sp.view : undefined);

  const threadTotal = await prisma.chatThread.count();
  const meta = buildListPageMeta(threadTotal, PAGE_SIZE, readListPage(sp));
  const nav = listPageNav("/admin/comms", sp, meta);

  const [threadsPage, inquiries, users, carRequests, leads, quotes] = await Promise.all([
    prisma.chatThread.findMany({
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      skip: meta.skip,
      take: PAGE_SIZE,
      include: threadInclude,
    }),
    prisma.inquiry.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
      include: {
        car: { select: { title: true } },
        threads: { take: 1, select: { id: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, email: true, name: true },
    }),
    prisma.carRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
      include: {
        chats: { take: 1, select: { id: true } },
        user: { select: { id: true, email: true } },
      },
    }),
    prisma.lead.findMany({
      orderBy: { updatedAt: "desc" },
      take: 120,
      include: {
        customer: { select: { id: true, email: true, name: true } },
        chats: { take: 1, select: { id: true } },
      },
    }),
    prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
      include: {
        customer: { select: { id: true, email: true } },
        car: { select: { title: true } },
        chatThread: { select: { id: true } },
      },
    }),
  ]);

  let threads = threadsPage;
  if (initialThreadId && !threads.some((t) => t.id === initialThreadId)) {
    const focused = await prisma.chatThread.findUnique({
      where: { id: initialThreadId },
      include: threadInclude,
    });
    if (focused) threads = [focused, ...threads];
  }

  const serializedThreads = threads.map((t) => ({
    id: t.id,
    subject: t.subject,
    lastMessageAt: t.lastMessageAt?.toISOString() ?? null,
    unreadForAdmin: t.unreadForAdmin,
    guestName: t.guestName,
    guestEmail: t.guestEmail,
    customer: t.customer,
    car: t.car,
    inquiry: t.inquiry,
  }));

  const inquiryRows = inquiries.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    message: r.message,
    carTitle: r.car?.title ?? null,
    threadId: r.threads[0]?.id ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const sourcingRows = carRequests.map((r) => ({
    id: r.id,
    guestName: r.guestName,
    guestEmail: r.guestEmail,
    guestPhone: r.guestPhone,
    brand: r.brand,
    model: r.model,
    status: r.status,
    threadId: r.chats[0]?.id ?? null,
    createdAt: r.createdAt.toISOString(),
    hasUser: Boolean(r.userId),
    userEmail: r.user?.email ?? null,
  }));

  const leadRows = leads.map((l) => ({
    id: l.id,
    stage: l.stage,
    title: l.title,
    customerEmail: l.customer?.email ?? null,
    threadId: l.chats[0]?.id ?? null,
    updatedAt: l.updatedAt.toISOString(),
  }));

  const quoteRows = quotes.map((q) => ({
    id: q.id,
    status: q.status,
    total: q.totalEstimate != null ? Number(q.totalEstimate) : null,
    currency: q.currency,
    customerEmail: q.customer?.email ?? null,
    carTitle: q.car?.title ?? null,
    threadId: q.chatThread?.id ?? null,
    createdAt: q.createdAt.toISOString(),
  }));

  const recentAnnouncements = await prisma.systemAnnouncement.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, title: true, body: true, recipientCount: true, createdAt: true },
  });

  const announcementRows = recentAnnouncements.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    recipientCount: a.recipientCount,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeading variant="dashboard">Live Support Chat</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Single support hub: conversations, Customer Inquiry, order inquiries, leads, quotes, private messages, and
        broadcasts. Customers use{" "}
        <span className="text-zinc-300">Customer Service Live Support Chat</span> at <span className="text-zinc-300">/chat</span>.
      </p>
      <AdminCommsClient
        threads={serializedThreads}
        initialThreadId={initialThreadId}
        inquiries={inquiryRows}
        users={users}
        initialView={initialView}
        carRequests={sourcingRows}
        leads={leadRows}
        quotes={quoteRows}
        recentAnnouncements={announcementRows}
      />
      {threadTotal > 0 ? (
        <ListPaginationFooter
          {...nav}
          page={meta.page}
          totalPages={meta.totalPages}
          totalItems={threadTotal}
          pageSize={PAGE_SIZE}
          itemLabel="Chat threads"
          showPerPageNote
        />
      ) : null}
    </div>
  );
}
