import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BYD_SEALION6_CALIBRATION,
  JETOUR_DASHING_CALIBRATION,
} from "@/lib/duty-assessment/fixtures/calibration-cases";
import { normalizeChargeName } from "@/lib/duty-assessment/charge-normalization";
import {
  buildAssessmentIdentityHash,
  buildDocumentChecksum,
  normalizeHsCode,
} from "@/lib/duty-assessment/identity";
import {
  maskBillOfEntry,
  maskChassis,
  maskVin,
  toMaskedAssessmentSummary,
} from "@/lib/duty-assessment/masking";
import {
  reconcileAssessmentLines,
  sumLinePayables,
} from "@/lib/duty-assessment/reconciliation";

describe("duty assessment charge normalization", () => {
  it("normalizes Import VAT aliases to IMPORT_VAT", () => {
    assert.equal(normalizeChargeName("Import VAT"), "IMPORT_VAT");
    assert.equal(normalizeChargeName("VAT on Import"), "IMPORT_VAT");
  });

  it("keeps Network Charge VAT separate from Import VAT", () => {
    assert.equal(normalizeChargeName("Network Charge VAT"), "NETWORK_CHARGE_VAT");
    assert.notEqual(normalizeChargeName("Network Charge VAT"), normalizeChargeName("Import VAT"));
  });

  it("normalizes GETFund naming variants", () => {
    assert.equal(normalizeChargeName("Ghana Education Trust Fund Levy"), "GETFUND_LEVY");
    assert.equal(normalizeChargeName("GETFund Levy"), "GETFUND_LEVY");
  });

  it("normalizes Special Import Levy with percentage suffix", () => {
    assert.equal(normalizeChargeName("Special Import Levy (2%)"), "SPECIAL_IMPORT_LEVY");
  });
});

describe("duty assessment identity and deduplication", () => {
  it("builds stable assessment identity hashes", () => {
    const a = buildAssessmentIdentityHash({
      billOfEntryNumber: "BOE-123",
      customsOffice: "Tema",
      assessmentDate: new Date("2024-01-15"),
      totalAssessedGhs: 61862.67,
    });
    const b = buildAssessmentIdentityHash({
      billOfEntryNumber: "BOE-123",
      customsOffice: "Tema",
      assessmentDate: new Date("2024-01-15"),
      totalAssessedGhs: 61862.67,
    });
    assert.equal(a, b);
  });

  it("changes hash when total amount differs", () => {
    const a = buildAssessmentIdentityHash({ billOfEntryNumber: "BOE-1", totalAssessedGhs: 100 });
    const b = buildAssessmentIdentityHash({ billOfEntryNumber: "BOE-1", totalAssessedGhs: 200 });
    assert.notEqual(a, b);
  });

  it("normalizes HS codes to dotted format", () => {
    assert.equal(normalizeHsCode("870323"), "8703.23");
    assert.equal(normalizeHsCode("870380"), "8703.80");
  });

  it("builds document checksums", () => {
    const checksum = buildDocumentChecksum("test-pdf-content");
    assert.match(checksum, /^[a-f0-9]{64}$/);
  });
});

describe("duty assessment reconciliation", () => {
  const boeLines = JETOUR_DASHING_CALIBRATION.lines;

  it("matches receipt lines to BoE lines without duplicating fees", () => {
    const receiptLines = [
      { chargeName: "Import VAT", amountPayable: 27404.09 },
      { chargeName: "GETFund Levy", amountPayable: 4567.35 },
    ];
    const result = reconcileAssessmentLines({ billOfEntryLines: boeLines, receiptLines });
    assert.deepEqual(result.matchedKeys.sort(), ["GETFUND_LEVY", "IMPORT_VAT"].sort());
    assert.equal(result.unmatchedReceiptLines.length, 0);
  });

  it("flags unmatched receipt-only items for admin review", () => {
    const receiptLines = [{ chargeName: "Mystery Port Fee", amountPayable: 99.99 }];
    const result = reconcileAssessmentLines({ billOfEntryLines: boeLines, receiptLines });
    assert.equal(result.unmatchedReceiptLines.length, 1);
    assert.equal(result.unmatchedReceiptLines[0]?.chargeName, "Mystery Port Fee");
  });

  it("prevents duplicate BoE charge keys", () => {
    const duplicateBoe = [
      ...boeLines,
      { chargeName: "Import Duty", amountPayable: 100 },
    ];
    const result = reconcileAssessmentLines({
      billOfEntryLines: duplicateBoe,
      receiptLines: [],
    });
    assert.ok(result.duplicateKeysPrevented.includes("IMPORT_DUTY"));
  });
});

describe("calibration fixture totals", () => {
  it("Jetour Dashing fixture lines sum to GHS 61,862.67", () => {
    const total = sumLinePayables(JETOUR_DASHING_CALIBRATION.lines);
    assert.equal(total, 61862.67);
    assert.equal(JETOUR_DASHING_CALIBRATION.totalAssessedGhs, 61862.67);
    assert.equal(JETOUR_DASHING_CALIBRATION.customsValueGhs, 166085.38);
    assert.equal(JETOUR_DASHING_CALIBRATION.vehicle.hsCode, "870323");
    assert.equal(JETOUR_DASHING_CALIBRATION.vehicle.fuelType, "GASOLINE");
  });

  it("BYD Sealion 6 fixture lines sum to GHS 151,699.89", () => {
    const total = sumLinePayables(BYD_SEALION6_CALIBRATION.lines);
    assert.equal(total, 151699.89);
    assert.equal(BYD_SEALION6_CALIBRATION.totalAssessedGhs, 151699.89);
    assert.equal(BYD_SEALION6_CALIBRATION.customsValueGhs, 303143.47);
    assert.equal(BYD_SEALION6_CALIBRATION.vehicle.hsCode, "870380");
    assert.equal(BYD_SEALION6_CALIBRATION.vehicle.fuelType, "ELECTRIC");
  });
});

describe("duty assessment secure masking", () => {
  it("masks VIN and chassis for admin list views", () => {
    assert.equal(maskVin("HJRPBGGB2NB525402"), "*************5402");
    assert.equal(maskChassis("LGXCH4CD7S0781407"), "*************1407");
  });

  it("masks bill of entry references", () => {
    assert.equal(maskBillOfEntry("BOE-2024-998877"), "BOE***877");
  });

  it("returns masked assessment summary without raw identifiers", () => {
    const summary = toMaskedAssessmentSummary({
      id: "asmt_1",
      billOfEntryNumber: "BOE-2024-998877",
      declarationReference: "DEC-123456",
      assessmentStatus: "ASSESSED",
      verificationStatus: "VERIFIED",
      totalAssessedGhs: 61862.67,
      totalPaidGhs: 61862.67,
      assessmentDate: new Date("2024-06-15"),
    });
    assert.equal(summary.billOfEntryNumber, "BOE***877");
    assert.equal(summary.declarationReference, "DEC***456");
    assert.equal(summary.totalAssessedGhs, 61862.67);
  });
});

describe("duty assessment admin access", () => {
  it("ingestBillOfEntryAction requires admin session", async () => {
    const { ingestBillOfEntryAction } = await import("@/actions/duty-assessment-admin");
    const result = await ingestBillOfEntryAction(JETOUR_DASHING_CALIBRATION);
    assert.equal(result.ok, undefined);
    assert.match(result.error ?? "", /Admin only|UNAUTHORIZED|ingestion failed/i);
  });
});

describe("bill of entry ingestion validation", () => {
  it("rejects BoE when line total does not match declared total", async () => {
    const { ingestBillOfEntry } = await import("@/lib/duty-assessment/ingestion");
    const badFixture = {
      ...JETOUR_DASHING_CALIBRATION,
      totalAssessedGhs: 99999,
    };

    await assert.rejects(
      () =>
        ingestBillOfEntry(
          {
            dutyAssessment: {
              findUnique: async () => null,
              create: async () => {
                throw new Error("should not create");
              },
            },
            dutyVehicleProfile: {
              findFirst: async () => null,
              create: async () => ({ id: "profile_1" }),
              update: async () => ({ id: "profile_1" }),
            },
          } as never,
          badFixture,
        ),
      /does not match totalAssessedGhs/,
    );
  });
});
