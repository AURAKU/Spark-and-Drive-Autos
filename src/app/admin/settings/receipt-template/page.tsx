import { ReceiptTemplateScope } from "@prisma/client";

import { resetReceiptTemplate, saveReceiptTemplate } from "@/actions/receipt-template";
import { PageHeading } from "@/components/typography/page-headings";
import { getReceiptTemplate } from "@/lib/receipt-template";

export const dynamic = "force-dynamic";

const field = "h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white";
const textarea = "min-h-20 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white";

async function ReceiptTemplateCard({ scope }: { scope: ReceiptTemplateScope }) {
  const t = await getReceiptTemplate(scope);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="text-lg font-semibold text-white">{scope === "CAR" ? "Car inventory receipt template" : "Parts receipt template"}</h2>
      <p className="mt-1 text-sm text-zinc-500">
        This template is used automatically whenever a {scope === "CAR" ? "car" : "parts"} payment succeeds.
      </p>
      <form action={saveReceiptTemplate} className="mt-5 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="scope" value={scope} />
        <input name="companyName" defaultValue={t.companyName} required className={field} />
        <input name="accentColor" defaultValue={t.accentColor} required className={field} />
        <input name="heading" defaultValue={t.heading} required className={field} />
        <input name="subheading" defaultValue={t.subheading} required className={field} />
        <input name="contactPhone" defaultValue={t.contactPhone} required className={field} />
        <input name="contactEmail" defaultValue={t.contactEmail} required className={field} />
        <input name="officeAddress" defaultValue={t.officeAddress} required className={`${field} sm:col-span-2`} />
        <input name="signatureLabel" defaultValue={t.signatureLabel} required className={field} />
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" name="showSignature" defaultChecked={t.showSignature} />
          Show signature line
        </label>
        <textarea name="disclaimer" defaultValue={t.disclaimer} required className={`${textarea} sm:col-span-2`} />
        <textarea name="thankYouNote" defaultValue={t.thankYouNote} required className={`${textarea} sm:col-span-2`} />
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
            Save {scope.toLowerCase()} template
          </button>
        </div>
      </form>
      <form action={resetReceiptTemplate} className="mt-4">
        <input type="hidden" name="scope" value={scope} />
        <button type="submit" className="text-sm text-zinc-400 hover:text-white">
          Reset to defaults
        </button>
      </form>
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
      </div>
      <ReceiptTemplateCard scope={ReceiptTemplateScope.CAR} />
      <ReceiptTemplateCard scope={ReceiptTemplateScope.PARTS} />
    </div>
  );
}
