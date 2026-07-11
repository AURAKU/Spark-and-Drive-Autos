import { getValuationConfigData } from "@/actions/duty-admin-os";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DutyValuationPage() {
  const data = await getValuationConfigData();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Freight matrix and insurance defaults used when customers do not supply values.</p>

      <section>
        <h3 className="text-sm font-semibold">Shipping cost matrix</h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border dark:border-white/10">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Origin</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Freight GHS</th>
                <th className="px-3 py-2">Transit days</th>
              </tr>
            </thead>
            <tbody>
              {data.shipping.map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="px-3 py-2">{row.originCountry}</td>
                  <td className="px-3 py-2">{row.vehicleCategory ?? "Default"}</td>
                  <td className="px-3 py-2">{row.shippingMethod}</td>
                  <td className="px-3 py-2">{formatMoney(Number(row.freightGhs))}</td>
                  <td className="px-3 py-2">{row.transitDays ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Insurance rules</h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border dark:border-white/10">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Origin</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Minimum GHS</th>
              </tr>
            </thead>
            <tbody>
              {data.insurance.map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="px-3 py-2">{row.originCountry ?? "Any"}</td>
                  <td className="px-3 py-2">{row.shippingMethod ?? "Any"}</td>
                  <td className="px-3 py-2">{Number(row.percentageRate) * 100}%</td>
                  <td className="px-3 py-2">{row.minimumGhs != null ? formatMoney(Number(row.minimumGhs)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
