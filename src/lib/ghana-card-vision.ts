import { normalizeGhanaCardId } from "@/lib/ghana-card-id";

function visionModel(): string {
  return process.env.OPENAI_GHANA_CARD_MODEL?.trim() || process.env.OPENAI_PARTS_FINDER_MODEL?.trim() || "gpt-4o-mini";
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Reads Ghana Card details from an image URL using in-house OpenAI vision.
 * Never throws; returns best-effort extracted fields.
 */
export async function extractGhanaCardDetailsFromImageUrl(imageUrl: string): Promise<{
  rawText: string | null;
  normalizedIdNumber: string | null;
  expiryDate: Date | null;
  usedAi: boolean;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { rawText: null, normalizedIdNumber: null, expiryDate: null, usedAi: false };
  }

  const body = {
    model: visionModel(),
    max_tokens: 260,
    messages: [
      {
        role: "system" as const,
        content:
          "You read Ghana Card (national ID) images. Extract ID number and expiry date if visible. " +
          "Return ONLY JSON with this exact shape: {\"idNumber\":string|null,\"expiryDate\":string|null}. " +
          "expiryDate must be ISO date YYYY-MM-DD or null.",
      },
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "Extract Ghana Card ID number and expiry date from this image." },
          { type: "image_url" as const, image_url: { url: imageUrl, detail: "high" as const } },
        ],
      },
    ],
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { rawText: null, normalizedIdNumber: null, expiryDate: null, usedAi: true };

    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) return { rawText: null, normalizedIdNumber: null, expiryDate: null, usedAi: true };

    let idNumber: string | null = null;
    let expiryDate: Date | null = null;
    try {
      const parsed = JSON.parse(text) as { idNumber?: unknown; expiryDate?: unknown };
      if (typeof parsed.idNumber === "string") idNumber = parsed.idNumber;
      else if (parsed.idNumber === null) idNumber = null;
      expiryDate = parseIsoDate(parsed.expiryDate);
    } catch {
      const idMatch = text.match(/GHA[\s-]*[0-9A-Z][\w-]*/i);
      idNumber = idMatch ? idMatch[0] : null;
      const dateMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
      expiryDate = parseIsoDate(dateMatch?.[0] ?? null);
    }

    return {
      rawText: idNumber ? String(idNumber).trim() : null,
      normalizedIdNumber: normalizeGhanaCardId(idNumber),
      expiryDate,
      usedAi: true,
    };
  } catch {
    return { rawText: null, normalizedIdNumber: null, expiryDate: null, usedAi: true };
  }
}
