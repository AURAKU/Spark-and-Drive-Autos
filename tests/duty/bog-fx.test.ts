import assert from "node:assert/strict";
import test from "node:test";

import { parseBogOfficialHtml, parseBogRateDate, parseStatsGhRows } from "@/lib/duty-intelligence/bog-fx";

const SAMPLE_HTML = `
<table>
<tr><th>Date</th><th>Currency</th><th>Currency Pair</th><th>Buying</th><th>Selling</th><th>Mid Rate</th></tr>
<tr><td>20 Oct 2026</td><td>US Dollar</td><td>USDGHS</td><td>11.6000</td><td>11.6116</td><td>11.6058</td></tr>
<tr><td>20 Oct 2026</td><td>Yuan Renminbi</td><td>CNYGHS</td><td>1.7368</td><td>1.7386</td><td>1.7377</td></tr>
</table>
`;

test("parses Bank of Ghana official HTML mid rates", () => {
  const snapshot = parseBogOfficialHtml(SAMPLE_HTML);
  assert.ok(snapshot);
  assert.equal(snapshot!.rateDate, "2026-10-20");
  const usd = snapshot!.pairs.find((p) => p.fromCurrency === "USD");
  assert.ok(usd);
  assert.equal(usd!.mid, 11.6058);
  assert.equal(snapshot!.pairs.find((p) => p.fromCurrency === "CNY")?.mid, 1.7377);
});

test("parses StatsGH rows for the latest published date", () => {
  const snapshot = parseStatsGhRows([
    { rate_date: "2026-10-19", pair: "USDGHS", buying: 11.5, selling: 11.51, mid: 11.505 },
    { rate_date: "2026-10-20", pair: "USDGHS", buying: 11.6, selling: 11.6116, mid: 11.6058 },
    { rate_date: "2026-10-20", pair: "EURGHS", buying: 13.02, selling: 13.03, mid: 13.0311 },
  ]);
  assert.ok(snapshot);
  assert.equal(snapshot!.rateDate, "2026-10-20");
  assert.equal(snapshot!.pairs.find((p) => p.fromCurrency === "USD")?.mid, 11.6058);
  assert.equal(snapshot!.pairs.length, 2);
});

test("parseBogRateDate accepts official table dates", () => {
  assert.equal(parseBogRateDate("20 Oct 2026"), "2026-10-20");
  assert.equal(parseBogRateDate("2026-10-20"), "2026-10-20");
});
