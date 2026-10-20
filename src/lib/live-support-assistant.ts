/**
 * Spark assistant — in-house live support replies for how this platform works.
 * Uses the same OpenAI pattern as Parts Finder when a key is configured;
 * otherwise a compact knowledge pack still produces a natural FAQ reply.
 */

import { LEGAL_COMPANY } from "@/lib/legal";
import { PARTS_FINDER_HERO_LINE, PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";
import { sanitizePlainText } from "@/lib/sanitize";

export const SPARK_ASSISTANT_LABEL = "Spark assistant";

export const STAFF_ACTIVE_MS = 6 * 60 * 60 * 1000;
export const ASSISTANT_MAX_REPLY = 900;
const LLM_TIMEOUT_MS = 12_000;

export type AssistantGenerateInput = {
  userText: string;
  hasAttachments?: boolean;
  recentTurns?: Array<{ role: "customer" | "assistant" | "team"; text: string }>;
};

export type AssistantGenerateResult = {
  reply: string;
  usedLlm: boolean;
  offTopic: boolean;
};

type KnowledgeTopic = {
  id: string;
  keywords: string[];
  reply: string;
};

const CONTACT_LINE = `We’re here ${LEGAL_COMPANY.workingHours}. You can also reach Spark and Drive Gear on ${LEGAL_COMPANY.phone} or ${LEGAL_COMPANY.supportEmail}.`;

export const LIVE_SUPPORT_KNOWLEDGE: KnowledgeTopic[] = [
  {
    id: "welcome",
    keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "help", "support"],
    reply: `Welcome to Spark & Drive Autos — I’m the Spark assistant. I can walk you through cars, Spark and Drive Gear parts, motorcycles, Parts Finder, duty, shipping, checkout, wallet, Ghana Card, receipts, and reservations. A teammate will join this same chat if you need a human. What would you like to sort out?`,
  },
  {
    id: "cars",
    keywords: ["car", "vehicle", "listing", "inventory", "buy a car", "used car", "import a car", "request a car"],
    reply: `You can browse published vehicles on /cars (and /inventory). Each listing shows availability and how payment is tracked. To ask us to source a specific car, use /request-a-car — we confirm specs and commercial terms before any commitment. I can’t quote a live price or stock from this chat; a teammate will confirm figures, or you can open the listing itself.`,
  },
  {
    id: "reservations",
    keywords: ["reserv", "deposit", "hold", "book the car", "reserve"],
    reply: `Reservations are only on eligible listings, after a deposit is paid and verified in our system. There’s a hold period; if the remaining balance isn’t completed in time, the reservation can lapse. Screenshots alone don’t confirm a hold. See /reservation-policy. For your own reservation status, check /dashboard/orders — a teammate can confirm the exact figures.`,
  },
  {
    id: "parts",
    keywords: ["part", "spare", "accessory", "gear", "oem", "filter", "brake", "storefront", "in stock"],
    reply: `Spark and Drive Gear is our parts and accessories storefront at /parts. Add items to cart and check out with Paystack (card or Mobile Money where available) or wallet. If we don’t have the part listed, use /request-autoparts and we’ll source against your specs. I don’t have live inventory or prices here — please use the product page, or a teammate can confirm.`,
  },
  {
    id: "parts-finder",
    keywords: ["parts finder", "finder", "vin", "chassis", "oem number", "fitment", "equivalent part"],
    reply: `${PARTS_FINDER_PRODUCT_NAME} is our VIN/chassis-aware search. ${PARTS_FINDER_HERO_LINE} Activate or renew from /parts-finder (Paystack or wallet). Results are guidance only — always verify fitment before you buy. Open /parts-finder/entry once you’re signed in.`,
  },
  {
    id: "motorcycles",
    keywords: ["motorcycle", "motorbike", "bike", "electric bike", "e-bike", "scooter"],
    reply: `Motorcycles and electric bikes live under /motorcycles and /electric-bikes-motorcycles. Listings, checkout, and reservations follow the same verified-payment rules as cars. For a specific bike, open the listing or tell a teammate the make and model — I won’t invent availability or a price.`,
  },
  {
    id: "duty",
    keywords: ["duty", "customs", "clearance", "gra", "import duty", "tariff", "cif"],
    reply: `We can assist with duty and clearance on request. Final duty and government charges are set by the authorities, not by this chat. Use the duty tools on the site for estimates only — they are not a GRA assessment. A teammate can review a specific vehicle or shipment with you. We never quote a guaranteed duty amount here.`,
  },
  {
    id: "shipping",
    keywords: ["ship", "delivery", "courier", "tracking", "freight", "china", "logistics", "arrive"],
    reply: `Shipping timelines are estimates — suppliers, vessels, and customs can shift dates. Track orders from /dashboard/orders and /dashboard/shipping where updates are posted. Some China-stock parts have international shipping quoted later (not always in the first checkout total). See /sourcing-policy. A teammate can confirm the lane for your order.`,
  },
  {
    id: "checkout",
    keywords: ["checkout", "paystack", "mobile money", "momo", "payment", "card", "how to pay"],
    reply: `Checkout is on-platform via Paystack (card and Mobile Money where available). Payments count only after our system verifies them. Manual or proof-of-payment options appear only when we offer them. Never send money to a personal number that isn’t shown in checkout. If a payment is pending, check /dashboard/payments — a teammate can reconcile a reference.`,
  },
  {
    id: "wallet",
    keywords: ["wallet", "fund", "balance", "top up"],
    reply: `Your parts wallet lives on your account. You can fund it, then pay for eligible parts and Parts Finder activation from that balance. Wallet activity is in your dashboard. I can’t see your live balance from here — open the wallet on the site, or a teammate can look it up with you.`,
  },
  {
    id: "ghana-card",
    keywords: ["ghana card", "ghanacard", "id number", "identity", "verification", "kyc", "national id"],
    reply: `We use Ghana Card details for checkout, delivery, and identity checks. Add your number and expiry under /dashboard/profile (verification). Keep the name consistent with your account. If a check is still pending, a teammate will confirm — I won’t guess verification status.`,
  },
  {
    id: "receipts",
    keywords: ["receipt", "invoice", "pdf", "proof of payment"],
    reply: `Receipts for confirmed payments are in /dashboard/receipts (and from the order page). If a receipt isn’t there yet, the payment may still be verifying. Share the order or payment reference with a teammate rather than expecting a figure from me.`,
  },
  {
    id: "orders",
    keywords: ["order", "status", "my order", "where is", "reference", "dashboard"],
    reply: `Sign in and open /dashboard/orders for status, payments, and shipping updates. Notifications also land in /dashboard/notifications. I can’t see your order records from this assistant, so I won’t invent a status — paste a reference if you’d like a teammate to pick this up.`,
  },
  {
    id: "account",
    keywords: ["account", "register", "login", "password", "profile", "address", "garage"],
    reply: `Create an account or sign in to use live chat, checkout, wallet, and your garage. From /dashboard you can update profile, addresses, Ghana Card, payments, and saved vehicles. Password reset is at /forgot-password. If you’re locked out, a teammate can help after we verify the account.`,
  },
  {
    id: "refunds",
    keywords: ["refund", "cancel", "money back", "chargeback"],
    reply: `Refunds are assessed case by case after payment verification. Duplicate or overpayments, or cases we cannot fulfil, may qualify. Sourcing deposits, logistics, customs, and gateway fees already incurred are often not refundable. Full policy: /refund-policy. Share your order reference and a teammate will review — I can’t approve a refund here.`,
  },
  {
    id: "policies",
    keywords: ["policy", "terms", "privacy", "legal", "dispute", "sourcing policy"],
    reply: `Key pages: /terms, /privacy, /faq, /reservation-policy, /refund-policy, /sourcing-policy, and /payment-dispute-policy. Spark & Drive Autos is Ghana-facing (Spark and Drive Gear). ${CONTACT_LINE}`,
  },
  {
    id: "hours",
    keywords: ["hour", "open", "close", "location", "address", "oyatifa", "contact", "phone", "email", "whatsapp"],
    reply: `${CONTACT_LINE} Office: ${LEGAL_COMPANY.officeAddress}. Live chat on /chat is the fastest way to keep everything in one thread.`,
  },
  {
    id: "human",
    keywords: ["human", "agent", "person", "someone", "staff", "manager", "real person", "talk to"],
    reply: `Of course. Stay on this thread — a teammate will continue from here. While you wait, you can keep describing the car, part, order reference, or question so they have context.`,
  },
];

const OFF_TOPIC_HINTS = [
  "weather",
  "football",
  "soccer",
  "politics",
  "election",
  "homework",
  "recipe",
  "dating",
  "girlfriend",
  "boyfriend",
  "crypto",
  "bitcoin",
  "stock tip",
  "joke",
  "poem",
  "write code",
  "programming",
  "linux",
  "windows license",
  "medical advice",
  "legal advice",
  "lottery",
];

const PLATFORM_HINTS = [
  "car",
  "part",
  "bike",
  "motor",
  "duty",
  "ship",
  "pay",
  "wallet",
  "ghana",
  "receipt",
  "order",
  "reserv",
  "finder",
  "spark",
  "drive",
  "gear",
  "vin",
  "checkout",
  "momo",
  "paystack",
  "refund",
  "deposit",
  "import",
  "clearance",
  "dashboard",
];

export function isHumanHandlingThread(input: {
  adminId: string | null | undefined;
  lastAdminAt: Date | null | undefined;
  now?: Date;
}): boolean {
  if (!input.adminId) return false;
  if (!input.lastAdminAt) return true;
  const now = input.now ?? new Date();
  return now.getTime() - input.lastAdminAt.getTime() < STAFF_ACTIVE_MS;
}

export function isLiveSupportLlmEnabled(): boolean {
  if (process.env.LIVE_SUPPORT_AI === "0") return false;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return false;
  if (process.env.LIVE_SUPPORT_AI === "1") return true;
  const provider = (process.env.AI_PROVIDER?.trim() || "openai").toLowerCase();
  return provider !== "none";
}

function liveSupportModel(): string {
  return (
    process.env.OPENAI_LIVE_SUPPORT_MODEL?.trim() ||
    process.env.OPENAI_PARTS_FINDER_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

export function looksOffTopic(text: string): boolean {
  const t = text.toLowerCase();
  if (!t.trim()) return false;
  const off = OFF_TOPIC_HINTS.some((h) => t.includes(h));
  const on = PLATFORM_HINTS.some((h) => t.includes(h));
  if (off && !on) return true;
  return false;
}

export function scoreTopic(text: string, topic: KnowledgeTopic): number {
  const t = text.toLowerCase();
  let score = 0;
  for (const kw of topic.keywords) {
    if (t.includes(kw)) score += kw.includes(" ") ? 2 : 1;
  }
  return score;
}

export function matchKnowledgeTopic(text: string): KnowledgeTopic | null {
  let best: KnowledgeTopic | null = null;
  let bestScore = 0;
  for (const topic of LIVE_SUPPORT_KNOWLEDGE) {
    const s = scoreTopic(text, topic);
    if (s > bestScore || (s === bestScore && s > 0)) {
      best = topic;
      bestScore = s;
    }
  }
  if (!best || bestScore <= 0) return null;
  return best;
}

const OFF_TOPIC_REPLY =
  "I’m here for Spark & Drive Autos — cars, parts, motorcycles, Parts Finder, duty, shipping, checkout, wallet, Ghana Card, receipts, and how the platform works. I can’t help with that topic. If you still need a person, stay on this chat and a teammate will join.";

const ATTACHMENT_REPLY =
  "I’ve received your file. I can explain how the platform works, but a teammate should review photos, documents, or voice notes for anything specific to your order or vehicle. Tell me what you’d like help with, or wait here and someone will continue this same thread.";

const GENERIC_REPLY = `I can help with how Spark & Drive Autos works — vehicles, Spark and Drive Gear parts, motorcycles, Parts Finder, duty, shipping, checkout, wallet, Ghana Card, receipts, and reservations. I won’t guess prices, duty, stock, or your order status. Point me at the step you’re on, or stay here and a teammate will pick this up. ${CONTACT_LINE}`;

export function fallbackAssistantReply(input: AssistantGenerateInput): AssistantGenerateResult {
  const text = (input.userText || "").trim();
  if (!text && input.hasAttachments) {
    return { reply: ATTACHMENT_REPLY, usedLlm: false, offTopic: false };
  }
  if (looksOffTopic(text)) {
    return { reply: OFF_TOPIC_REPLY, usedLlm: false, offTopic: true };
  }
  const topic = matchKnowledgeTopic(text);
  if (topic) {
    return { reply: topic.reply, usedLlm: false, offTopic: false };
  }
  if (input.hasAttachments) {
    return { reply: ATTACHMENT_REPLY, usedLlm: false, offTopic: false };
  }
  return { reply: GENERIC_REPLY, usedLlm: false, offTopic: false };
}

export function sanitizeAssistantReply(raw: string): string {
  let s = sanitizePlainText(raw, ASSISTANT_MAX_REPLY);
  s = s.replace(/\s+/g, " ").replace(/\s+\n/g, "\n").trim();
  s = s.replace(/https?:\/\/\S+|www\.\S+/gi, (url) => {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      const host = u.hostname.replace(/^www\./, "");
      if (host.endsWith("sparkanddriveautos.com") || host === "localhost" || host === "127.0.0.1") {
        return `${u.pathname}${u.search}` || "/";
      }
    } catch {
      /* drop */
    }
    return "";
  });
  s = s
    .replace(/\b(as an ai|as a language model|i'm an ai|i am an ai|chatgpt|openai|anthropic|claude)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!s) return GENERIC_REPLY;
  return s.slice(0, ASSISTANT_MAX_REPLY);
}

function knowledgePackForLlm(): string {
  return LIVE_SUPPORT_KNOWLEDGE.map((t) => `## ${t.id}\n${t.reply}`).join("\n\n");
}

const SYSTEM_PROMPT = `You are the Spark assistant for Spark & Drive Autos (Spark and Drive Gear), a Ghana-facing automotive commerce platform.

Voice: warm, professional, welcoming, human. Short and precise. Not robotic, not salesy, not a generic chatbot. Use “I” and “we” naturally. Ghana English is fine; keep it clear.

You answer ONLY how this platform works: cars, parts, motorcycles / electric bikes, Spark Parts Finder, duty/customs estimates vs GRA, shipping, checkout (Paystack / Mobile Money), wallet, Ghana Card, receipts, reservations, refunds, policies, dashboard pages, account help.

If the customer is off-topic (weather, sports, homework, medical/legal advice, coding, etc.), politely decline in one or two sentences and offer to connect a human on this same thread.

Never invent prices, duty amounts, order statuses, inventory, tracking numbers, or verification outcomes. If they need account-specific data, say a teammate will confirm, and point them to the right page (/dashboard/orders, /dashboard/payments, /dashboard/receipts, /dashboard/profile, /parts, /cars, /parts-finder).

Do not claim you have already handed them to a person unless they asked — say a teammate can join this same chat if needed.

Return JSON only: {"reply":"string","offTopic":boolean}

Platform knowledge:
${knowledgePackForLlm()}

Contact: ${LEGAL_COMPANY.phone} · ${LEGAL_COMPANY.supportEmail} · ${LEGAL_COMPANY.officeAddress} · ${LEGAL_COMPANY.workingHours}
`;

export async function generateLiveSupportReply(
  input: AssistantGenerateInput,
): Promise<AssistantGenerateResult> {
  const fallback = fallbackAssistantReply(input);
  if (!isLiveSupportLlmEnabled()) return fallback;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback;

  const userText =
    (input.userText || "").trim() ||
    (input.hasAttachments ? "(Customer sent a photo, video, document, or voice note with no caption.)" : "");
  if (!userText) return fallback;

  const history = (input.recentTurns ?? [])
    .slice(-8)
    .map((t) => `${t.role}: ${t.text}`.slice(0, 400))
    .join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: liveSupportModel(),
        temperature: 0.35,
        max_tokens: 420,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${history ? `Recent thread:\n${history}\n\n` : ""}Latest customer message:\n${userText}`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return fallback;
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return fallback;
    let parsed: { reply?: unknown; offTopic?: unknown };
    try {
      parsed = JSON.parse(content) as { reply?: unknown; offTopic?: unknown };
    } catch {
      return fallback;
    }
    const reply = typeof parsed.reply === "string" ? sanitizeAssistantReply(parsed.reply) : "";
    if (!reply) return fallback;
    return {
      reply,
      usedLlm: true,
      offTopic: Boolean(parsed.offTopic) || looksOffTopic(userText),
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
