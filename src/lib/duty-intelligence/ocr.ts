/**
 * OCR document extraction interface.
 * Production: integrate with Google Document AI, AWS Textract, or similar.
 * Current implementation: pattern-based extraction from text content when available.
 */
export type OcrExtractedFields = {
  vin?: string;
  fobAmount?: number;
  fobCurrency?: string;
  freightGhs?: number;
  insuranceGhs?: number;
  exchangeRate?: number;
  hsCode?: string;
  billOfEntryNumber?: string;
  billOfLading?: string;
  containerNumber?: string;
  importDutyGhs?: number;
  vatGhs?: number;
  confidence: Record<string, number>;
};

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
const HS_RE = /\b(8703[\.\s]?\d{2,4})\b/i;
const MONEY_RE = /(?:GHS|GH¢|USD|\$)\s*([\d,]+\.?\d*)/gi;
const BOE_RE = /(?:bill of entry|boe|entry no\.?)\s*[:#]?\s*([A-Z0-9\-\/]+)/i;
const BOL_RE = /(?:bill of lading|b\/l|bol)\s*[:#]?\s*([A-Z0-9\-\/]+)/i;
const CONTAINER_RE = /\b([A-Z]{4}\d{7})\b/;

export async function extractFromDocumentText(text: string): Promise<OcrExtractedFields> {
  const confidence: Record<string, number> = {};
  const result: OcrExtractedFields = { confidence };

  const vinMatch = text.match(VIN_RE);
  if (vinMatch) {
    result.vin = vinMatch[1].toUpperCase();
    confidence.vin = 0.85;
  }

  const hsMatch = text.match(HS_RE);
  if (hsMatch) {
    result.hsCode = hsMatch[1].replace(/\s/g, "");
    confidence.hsCode = 0.75;
  }

  const boeMatch = text.match(BOE_RE);
  if (boeMatch) {
    result.billOfEntryNumber = boeMatch[1];
    confidence.billOfEntryNumber = 0.7;
  }

  const bolMatch = text.match(BOL_RE);
  if (bolMatch) {
    result.billOfLading = bolMatch[1];
    confidence.billOfLading = 0.7;
  }

  const containerMatch = text.match(CONTAINER_RE);
  if (containerMatch) {
    result.containerNumber = containerMatch[1];
    confidence.containerNumber = 0.8;
  }

  const moneyMatches = [...text.matchAll(MONEY_RE)];
  if (moneyMatches.length > 0) {
    const amounts = moneyMatches.map((m) => ({
      raw: m[0],
      value: parseFloat(m[1].replace(/,/g, "")),
    }));
    const ghsAmounts = amounts.filter((a) => /GHS|GH¢/i.test(a.raw));
    if (ghsAmounts.length >= 2) {
      result.importDutyGhs = ghsAmounts[0].value;
      result.vatGhs = ghsAmounts[1].value;
      confidence.importDutyGhs = 0.5;
      confidence.vatGhs = 0.5;
    }
    const usd = amounts.find((a) => /USD|\$/i.test(a.raw));
    if (usd) {
      result.fobAmount = usd.value;
      result.fobCurrency = "USD";
      confidence.fobAmount = 0.55;
    }
  }

  return result;
}

export async function processDocumentOcr(params: {
  documentId: string;
  textContent?: string;
}): Promise<OcrExtractedFields> {
  const extracted = params.textContent
    ? await extractFromDocumentText(params.textContent)
    : { confidence: {} };

  return extracted;
}
