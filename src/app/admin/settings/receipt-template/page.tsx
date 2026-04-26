import { ReceiptType } from "@prisma/client";
import Link from "next/link";

import { activateReceiptTemplate, resetReceiptTemplate, saveReceiptTemplate } from "@/actions/receipt-template";
import { PageHeading } from "@/components/typography/page-headings";
import { getActiveReceiptTemplate, getReceiptTemplatesByType } from "@/lib/receipt-template";

export const dynamic = "force-dynamic";

const field = "h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white";
const textarea = "min-h-20 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white";

async function ReceiptTemplateCard({ type }: { type: ReceiptType }) {
  const t = await getActiveReceiptTemplate(type);
  const versions = await getReceiptTemplatesByType(type);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-lg font-semibold text-white">{type.replaceAll("_", " ")}</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Active template v{t.version} is used automatically for future successful payments in this receipt category.
      </p>
      <form action={saveReceiptTemplate} className="mt-5 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="type" value={type} />
        <input name="businessName" defaultValue={t.businessName} required className={field} />
        <input name="title" defaultValue={t.title} required className={field} />
        <input name="categoryLabel" defaultValue={t.categoryLabel} required className={field} />
        <input name="accentColor" defaultValue={t.accentColor} required className={field} />
        <input name="phone" defaultValue={t.phone} required className={field} />
        <input name="email" defaultValue={t.email} required className={field} />
        <input name="address" defaultValue={t.address} required className={`${field} sm:col-span-2`} />
        <input name="signatureLabel" defaultValue={t.signatureLabel} required className={field} />
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" name="showSignatureLine" defaultChecked={t.showSignatureLine} />
          Show signature line
        </label>
        <textarea name="legalNote" defaultValue={t.legalNote} required className={`${textarea} sm:col-span-2`} />
        <textarea name="footerNote" defaultValue={t.footerNote} required className={`${textarea} sm:col-span-2`} />
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
            Save and activate new version
          </button>
        </div>
      </form>
      <form action={resetReceiptTemplate} className="mt-4">
        <input type="hidden" name="type" value={type} />
        <button type="submit" className="text-sm text-zinc-400 hover:text-white">
          Reset to defaults
        </button>
      </form>
      <div className="mt-5 rounded-xl border border-white/10 p-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Recent versions</p>
        <ul className="mt-2 space-y-2 text-sm text-zinc-300">
          {versions.slice(0, 5).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2">
              <span>
                v{v.version} · {v.title} {v.isActive ? "(active)" : ""}
              </span>
              {!v.isActive ? (
                <form action={activateReceiptTemplate}>
                  <input type="hidden" name="templateId" value={v.id} />
                  <button type="submit" className="text-xs text-[var(--brand)] hover:underline">
                    Activate
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default async function ReceiptTemplateSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <PageHeading variant="dashboard">Receipt templates</PageHeading>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Design and control receipt templates used to generate PDF receipts on successful payments. Your updates are
          saved and applied to future receipts automatically.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/admin/receipts" className="text-[var(--brand)] hover:underline">
            Open receipts archive →
          </Link>
        </p>
      </div>
      {Object.values(ReceiptType).map((type) => (
        <ReceiptTemplateCard key={type} type={type} />
      ))}
    </div>
  );
}
