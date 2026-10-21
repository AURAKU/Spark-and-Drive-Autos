/**
 * Spark assistant — in-house live support replies for how this platform works.
 * Uses the same OpenAI pattern as Parts Finder when a key is configured;
 * otherwise a compact knowledge pack still produces a natural FAQ reply.
 */

import { LEGAL_COMPANY } from "@/lib/legal";
import { PARTS_FINDER_HERO_LINE, PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";
import { sanitizePlainText } from "@/lib/sanitize";

export const SPARK_ASSISTANT_LABEL = "SPARK Assistant";

export const SPARK_WELCOME_REPLY = `Hi. I’m Spark, here to help.

Ask about a car, a part, shipping, or anything else on the site. If you’d rather talk to someone on the team, stay on this chat.`;

export const STAFF_ACTIVE_MS = 6 * 60 * 60 * 1000;
export const ASSISTANT_MAX_REPLY = 900;
const LLM_TIMEOUT_MS = 12_000;

export type AssistantGenerateInput = {
  userText: string;
  hasAttachments?: boolean;
  recentTurns?: Array<{ role: "customer" | "assistant" | "team"; text: string }>;
  /** Guest cookie visitor vs signed-in customer. Never implies access to their records. */
  viewer?: "guest" | "customer";
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

const CONTACT_LINE = `We’re here Monday to Saturday, 8:30 AM to 5:30 PM (GMT). You can also reach Spark and Drive Gear on ${LEGAL_COMPANY.phone} or ${LEGAL_COMPANY.supportEmail}.`;

const PAID_WORK_REPLY = `I can show you where to do that on the site. I don’t run lookups, quotes, or paid tools from this chat.

For a car or part, open the listing. For VIN search, activate Spark Parts Finder at /parts-finder. A teammate can join if you get stuck.`;

export const SPARK_CHAT_SUGGESTIONS = [
  { label: "Buy a car", text: "How do I buy a car on this site?" },
  { label: "Parts and Gear", text: "How do I buy parts on Spark and Drive Gear?" },
  { label: "Shipping and duty", text: "How do shipping and duty work?" },
  { label: "Payments", text: "How do I pay and get a receipt?" },
] as const;

const INAPPROPRIATE_REPLY = `Let’s keep this chat respectful.

Ask about cars, parts, shipping, or your order, or stay here for a teammate.`;

const SENSITIVE_REPLY = `I can help with how this site works for you.

Stay on this chat if you’d like a teammate.`;

const OFF_TOPIC_REPLY = `I’m here for how Spark & Drive Autos works, not that topic.

Stay on this chat if you’d like a teammate instead.`;

const ATTACHMENT_REPLY = `Thanks. I’ve got your file.

I can explain how the site works. For something specific to your order or vehicle, a teammate should review it. What would you like help with?`;

const GENERIC_REPLY = `Tell me what you’re trying to do: a car, a part, shipping, a payment, or an order, and I’ll point you the right way.

I won’t guess prices, stock, or your order status. A teammate can join this chat if you need one.`;

export const LIVE_SUPPORT_KNOWLEDGE: KnowledgeTopic[] = [
  {
    id: "welcome",
    keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"],
    reply: SPARK_WELCOME_REPLY,
  },
  {
    id: "about",
    keywords: [
      "about spark",
      "about you",
      "about the company",
      "about this site",
      "who are you",
      "who is spark",
      "what is spark",
      "your company",
      "what do you do",
    ],
    reply: `Spark & Drive Autos is a Ghana-focused automotive platform. We sell vehicles, parts, and accessories, and we help with sourcing, shipping, and clearance on request.

The registered business is Spark and Drive Gear. Read /about, or stay on this chat if you’d rather talk to a teammate.`,
  },
  {
    id: "what-spark-can-do",
    keywords: ["what can you do", "what can spark", "how does this chat", "what do you help"],
    reply: `I can explain how the public site works: cars, parts, shipping, payments, reservations, refunds, and your dashboard.

I won’t quote prices, run Parts Finder, calculate duty, or look up your orders. A teammate can join this same chat.`,
  },
  {
    id: "cars",
    keywords: ["car", "vehicle", "listing", "inventory", "buy a car", "used car", "import a car"],
    reply: `Browse published vehicles on /inventory. Open a listing for photos, specs, and how payment works.

If we don’t have the car, send a brief on /request-a-car. I won’t guess a price or stock from here. The listing, or a teammate, will confirm.`,
  },
  {
    id: "request-car",
    keywords: ["request a car", "source a car", "find me a car", "import a vehicle", "car request"],
    reply: `If the car isn’t on /inventory, send the make, model, year, and budget on /request-a-car. We confirm terms before any commitment.

A request is not a hold or a quote until our team replies. A teammate can pick this up on this chat.`,
  },
  {
    id: "compare",
    keywords: ["compare", "comparison", "side by side", "versus", "vs "],
    reply: `Use /compare to put published vehicles side by side. Add cars from inventory or a listing, then review specs together. Compare is for published stock only. It won’t invent specs or prices that aren’t on the listing.`,
  },
  {
    id: "reservations",
    keywords: ["reserv", "deposit", "hold", "book the car", "reserve"],
    reply: `Reservations are only on eligible listings, after a deposit is paid and verified in our system. There’s a hold period; if the remaining balance isn’t completed in time, the reservation can lapse. Screenshots alone don’t confirm a hold. See /reservation-policy. For your own reservation status, check /dashboard/orders. A teammate can confirm the exact figures.`,
  },
  {
    id: "parts",
    keywords: ["part", "spare", "accessory", "gear", "oem", "filter", "brake", "storefront", "in stock"],
    reply: `Spark and Drive Gear is our parts and accessories storefront at /parts. Add items to cart and check out with Paystack (card or Mobile Money where available) or wallet. If we don’t have the part listed, use /request-autoparts and we’ll source against your specs. I don’t have live inventory or prices here. Please use the product page, or a teammate can confirm.`,
  },
  {
    id: "request-parts",
    keywords: ["request autoparts", "request a part", "source a part", "can't find the part", "cannot find the part"],
    reply: `If the part isn’t on /parts, send the vehicle, OEM number if you have it, and quantity on /request-autoparts. We source against your specs and confirm before you pay.

A request is not a guaranteed stock or price. I won’t invent a match from here.`,
  },
  {
    id: "parts-finder",
    keywords: ["parts finder", "finder", "vin", "chassis", "oem number", "fitment", "equivalent part"],
    reply: `${PARTS_FINDER_PRODUCT_NAME} is our VIN/chassis-aware search. ${PARTS_FINDER_HERO_LINE} Activate or renew from /parts-finder (Paystack or wallet). Results are guidance only. Always verify fitment before you buy. Open /parts-finder/entry once you’re signed in.`,
  },
  {
    id: "motorcycles",
    keywords: ["motorcycle", "motorbike", "bike", "electric bike", "e-bike", "scooter"],
    reply: `Motorcycles and electric bikes live under /motorcycles and /electric-bikes-motorcycles. Listings, checkout, and reservations follow the same verified-payment rules as cars. For a specific bike, open the listing or tell a teammate the make and model. I won’t invent availability or a price.`,
  },
  {
    id: "duty",
    keywords: ["duty", "customs", "clearance", "gra", "import duty", "tariff", "cif", "estimate", "import estimate"],
    reply: `We can assist with duty and clearance on request. Final duty and government charges are set by the authorities, not by this chat.

Planning estimates, when we prepare them, appear on /dashboard/estimates after you sign in. They are not a GRA assessment. I never quote a duty amount here. A teammate can review a specific vehicle with you.`,
  },
  {
    id: "sourcing",
    keywords: ["sourcing", "source internationally", "supplier", "from china", "from abroad"],
    reply: `We source vehicles and parts internationally against your approved specs. Availability depends on the supplier. Nothing is guaranteed until commercial terms are confirmed.

See /sourcing-policy and /request-a-car or /request-autoparts. I won’t name suppliers or invent lead times.`,
  },
  {
    id: "shipping",
    keywords: ["ship", "delivery", "courier", "tracking", "freight", "china", "logistics", "arrive"],
    reply: `Shipping timelines are estimates. Suppliers, vessels, and customs can shift dates. Track orders from /dashboard/orders and /dashboard/shipping where updates are posted. Some China-stock parts have international shipping quoted later (not always in the first checkout total). See /sourcing-policy. A teammate can confirm the lane for your order.`,
  },
  {
    id: "checkout",
    keywords: ["checkout", "paystack", "mobile money", "momo", "payment", "card", "how to pay"],
    reply: `Checkout is on-platform via Paystack (card and Mobile Money where available). Payments count only after our system verifies them. Manual or proof-of-payment options appear only when we offer them. Never send money to a personal number that isn’t shown in checkout. If a payment is pending, check /dashboard/payments. A teammate can reconcile a reference.`,
  },
  {
    id: "wallet",
    keywords: ["wallet", "fund", "balance", "top up"],
    reply: `Your parts wallet lives on your account. You can fund it, then pay for eligible parts and Parts Finder activation from that balance. Wallet activity is in your dashboard. I can’t see your live balance from here. Open the wallet on the site, or a teammate can look it up with you.`,
  },
  {
    id: "ghana-card",
    keywords: ["ghana card", "ghanacard", "id number", "identity", "verification", "kyc", "national id"],
    reply: `We use Ghana Card details for checkout, delivery, and identity checks. Add your number and expiry under /dashboard/profile (verification). Keep the name consistent with your account. If a check is still pending, a teammate will confirm. I won’t guess verification status.`,
  },
  {
    id: "receipts",
    keywords: ["receipt", "invoice", "pdf", "proof of payment"],
    reply: `Receipts for confirmed payments are in /dashboard/receipts (and from the order page). If a receipt isn’t there yet, the payment may still be verifying. Share the order or payment reference with a teammate rather than expecting a figure from me.`,
  },
  {
    id: "orders",
    keywords: ["order", "status", "my order", "where is", "reference", "dashboard"],
    reply: `Sign in and open /dashboard/orders for status, payments, and shipping updates. Notifications also land in /dashboard/notifications. I can’t see your order records from this assistant, so I won’t invent a status. Paste a reference if you’d like a teammate to pick this up.`,
  },
  {
    id: "account",
    keywords: ["account", "register", "login", "password", "profile", "address", "garage"],
    reply: `You can browse and chat here without an account. Sign in or create an account to check out, use wallet, save favorites, keep a garage, and see your own orders, payments, and receipts on /dashboard. Password reset is at /forgot-password.`,
  },
  {
    id: "favorites",
    keywords: ["favorite", "favourite", "wishlist", "save", "cart"],
    reply: `Signed-in customers can save favorites and use cart from the listing or /dashboard/favorites. Guests can still browse and use this chat. I can’t see your saved items from here. Open the dashboard after you sign in.`,
  },
  {
    id: "disputes",
    keywords: ["dispute", "chargeback", "payment dispute"],
    reply: `If a payment or order needs a complaint, start with us so we can try to resolve it. See /payment-dispute-policy and /refund-policy. Share your own order or payment reference on this thread for a teammate. I cannot open another customer’s case or approve a chargeback here.`,
  },
  {
    id: "refunds",
    keywords: ["refund", "cancel", "money back", "chargeback"],
    reply: `Refunds are assessed case by case after payment verification. Duplicate or overpayments, or cases we cannot fulfil, may qualify. Sourcing deposits, logistics, customs, and gateway fees already incurred are often not refundable. Full policy: /refund-policy. Share your order reference and a teammate will review. I can’t approve a refund here.`,
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
    id: "platform-guide",
    keywords: ["platform guide", "motion guide", "how to use the site", "how do I navigate", "walkthrough", "site guide"],
    reply: `The Platform Guide walks through every live page and shows where to tap next.

Open /faq#platform-guide. Pick a journey, then follow the steps. A teammate can join this chat if you get stuck.`,
  },
  {
    id: "human",
    keywords: ["human", "agent", "person", "someone", "staff", "manager", "real person", "talk to"],
    reply: `Of course. Stay on this thread. A teammate will continue from here. While you wait, you can keep describing the car, part, order reference, or question so they have context.`,
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
  "compare",
  "faq",
  "guide",
  "contact",
  "favorite",
  "cart",
  "estimate",
];

const SENSITIVE_PROBES = [
  "admin password",
  "list all users",
  "all customers",
  "other customer",
  "other user's",
  "other users",
  "show me everyone",
  "dump the database",
  "api key",
  "secret key",
  "give me the otp",
  "what is my password",
  "staff login",
  "/admin",
  "super admin",
  "everyone's email",
  "ghana card number",
  "card pin",
  "cvv",
  "staff emails",
  "list all orders",
  "show other people",
  "encryption key",
  "internal tool",
  "how do you store",
];

const ABUSE_HINTS = [
  "fuck you",
  "fucking idiot",
  "kill yourself",
  "kys",
  "nigger",
  "nigga",
  "slut",
  "whore",
  "porn",
  "nudes",
  "nude pic",
  "suck my",
  "dick pic",
  "sex with",
];

export function looksSensitiveProbe(text: string): boolean {
  const t = text.toLowerCase();
  return SENSITIVE_PROBES.some((p) => t.includes(p));
}

export function looksInappropriate(text: string): boolean {
  const t = text.toLowerCase();
  return ABUSE_HINTS.some((p) => t.includes(p));
}

export function looksPaidWorkRequest(text: string): boolean {
  const t = text.toLowerCase();
  if (!t.trim()) return false;
  if (
    /\b(how much|what(?:'s| is) the (?:price|cost|duty)|quote (?:me|the|my)|give me (?:a |the )?(?:quote|price|cost|duty)|calculate|compute|estimate my)\b/.test(
      t,
    ) &&
    /\b(duty|cif|landed|customs|tariff|price|cost|ghs|cedis)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(decode|lookup|look up|run|search)\b.{0,40}\b(vin|chassis)\b/.test(t) ||
    /\b(vin|chassis)\b.{0,40}\b(decode|lookup|look up)\b/.test(t) ||
    /\bfind (?:the |my |this )?part\b.{0,40}\b(vin|chassis)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(do you have|is .{0,24} in stock|check stock|live inventory|available now)\b/.test(t) &&
    /\b(part|filter|brake|oil|jetour|toyota|honda|camry|bike|car)\b/.test(t)
  ) {
    return true;
  }
  if (/\b(identify this part|what part is this|which oem|find the equivalent)\b/.test(t)) {
    return true;
  }
  if (/\b(free|waive|without pay(?:ing)?|skip (?:the )?fee)\b.{0,30}\b(parts finder|finder|duty)\b/.test(t)) {
    return true;
  }
  if (/\bgive me a quote\b/.test(t) || /\bquote (?:this|the|my) (?:car|vehicle|part|shipment|duty)\b/.test(t)) {
    return true;
  }
  return false;
}

function looksGreeting(text: string): boolean {
  const t = text.trim().toLowerCase();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) return false;
  return /^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(t);
}

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

const EXACT_WORD_KEYWORDS = new Set(["pin", "otp", "admin", "cvv", "pan", "token"]);

function keywordMatches(text: string, keyword: string): boolean {
  const t = text.toLowerCase();
  const k = keyword.toLowerCase().trim();
  if (!k) return false;
  if (k.includes(" ")) return t.includes(k);
  if (k.length <= 3 || EXACT_WORD_KEYWORDS.has(k)) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  }
  return t.includes(k);
}

export function scoreTopic(text: string, topic: KnowledgeTopic): number {
  let score = 0;
  for (const kw of topic.keywords) {
    if (keywordMatches(text, kw)) score += kw.includes(" ") ? 2 : 1;
  }
  return score;
}

export function matchKnowledgeTopic(text: string): KnowledgeTopic | null {
  let best: KnowledgeTopic | null = null;
  let bestScore = 0;
  for (const topic of LIVE_SUPPORT_KNOWLEDGE) {
    if (topic.id === "welcome") continue;
    const s = scoreTopic(text, topic);
    if (s > bestScore) {
      best = topic;
      bestScore = s;
    }
  }
  if (best && bestScore > 0) return best;
  const welcome = LIVE_SUPPORT_KNOWLEDGE.find((topic) => topic.id === "welcome");
  if (welcome && scoreTopic(text, welcome) > 0 && looksGreeting(text)) {
    return welcome;
  }
  return null;
}

export function fallbackAssistantReply(input: AssistantGenerateInput): AssistantGenerateResult {
  const text = (input.userText || "").trim();
  if (!text && input.hasAttachments) {
    return { reply: ATTACHMENT_REPLY, usedLlm: false, offTopic: false };
  }
  if (looksInappropriate(text)) {
    return { reply: INAPPROPRIATE_REPLY, usedLlm: false, offTopic: false };
  }
  if (looksSensitiveProbe(text)) {
    return { reply: SENSITIVE_REPLY, usedLlm: false, offTopic: false };
  }
  if (looksPaidWorkRequest(text)) {
    return { reply: PAID_WORK_REPLY, usedLlm: false, offTopic: false };
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

/** Show a human welcome even if an older crowded greeting is still stored on the thread. */
export function displayAssistantBody(body: string): string {
  const t = body.trim();
  if (/I can walk you through cars/i.test(t) || /^Welcome to Spark & Drive Autos/i.test(t)) {
    return SPARK_WELCOME_REPLY;
  }
  if (/I can help with how Spark & Drive Autos works/i.test(t)) {
    return GENERIC_REPLY;
  }
  if (
    /I can only help with how this public platform works/i.test(t) ||
    /I cannot open admin tools/i.test(t) ||
    /Never send secrets in chat/i.test(t) ||
    /I can’t open other accounts, admin tools/i.test(t)
  ) {
    return SENSITIVE_REPLY;
  }
  if (/You can browse published vehicles on \/inventory \(also \/cars\)/i.test(t)) {
    return LIVE_SUPPORT_KNOWLEDGE.find((k) => k.id === "cars")?.reply ?? t;
  }
  return body;
}

export function sanitizeAssistantReply(raw: string): string {
  let s = raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, ASSISTANT_MAX_REPLY);
  s = s.replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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
  s = s.replace(/\/admin(?:\/[\w\-/?=&%]*)?/gi, "/");
  s = s.replace(/\bsk-[a-zA-Z0-9_-]{10,}\b/g, "");
  s = s.replace(/\b(DATABASE_URL|OPENAI_API_KEY|NEXTAUTH_SECRET|PUSHER_SECRET|CLOUDINARY_API_SECRET)\b/gi, "");
  s = s
    .replace(/\b(as an ai|as a language model|i'm an ai|i am an ai|chatgpt|openai|anthropic|claude)\b/gi, "")
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!s) return GENERIC_REPLY;
  if (
    /admin tools|other customers’ accounts|other customer's accounts|ghana card numbers|internal systems|never send secrets|card pin|staff list/i.test(
      s,
    )
  ) {
    return SENSITIVE_REPLY;
  }
  if (
    /\b(your duty is|estimated duty:?|landed cost is|decoded vin|oem match:|in stock:?\s*\d)\b/i.test(s) ||
    /\bGHS\s*[\d,]{3,}/i.test(s)
  ) {
    return PAID_WORK_REPLY;
  }
  if (looksInappropriate(s)) {
    return INAPPROPRIATE_REPLY;
  }
  return s.slice(0, ASSISTANT_MAX_REPLY);
}

function knowledgePackForLlm(): string {
  return LIVE_SUPPORT_KNOWLEDGE.map((t) => `## ${t.id}\n${t.reply}`).join("\n\n");
}

const SYSTEM_PROMPT = `You are the Spark assistant for Spark & Drive Autos (Spark and Drive Gear), a Ghana-facing automotive commerce platform.

Voice: a calm concierge. Warm, professional, human. Two or three short sentences. One idea per sentence. Use a blank line between thoughts. Never list every service in one breath. Not robotic, not salesy. Use “I” and “we” naturally. Ghana English is fine; keep it clear.

You help visitors use the public platform: /inventory, /compare, /request-a-car, /parts, /request-autoparts, Spark Parts Finder (/parts-finder), /motorcycles, /electric-bikes-motorcycles, shipping, checkout (Paystack / Mobile Money), wallet, receipts, reservations, refunds, /faq, /about, /contact, /dashboard/estimates (team-prepared planning only), policies, and this live chat on /chat. Guests may chat and browse without an account. Checkout, wallet, favorites, garage, and order history need a signed-in account.

Paid work (hard rule):
- Never run Parts Finder, decode a VIN, calculate duty, quote landed cost, check live stock, price a specific vehicle, identify a part from a photo, or waive a fee.
- If they ask you to do that work, point them to the public page or paid tool in two sentences. Offer a teammate.

Security (hard rules):
- Never invent prices, duty amounts, order statuses, inventory, tracking numbers, verification outcomes, or other people’s data.
- Never name or describe internal tools, staff areas, suppliers, margins, ranking methods, other people’s accounts, secrets, or how we store identity or payment data.
- If they ask for something you cannot do, refuse in one or two clean sentences. Do not list what is restricted. Offer a teammate on this same thread.
- Never ask them to paste private account, Ghana Card, OTP, PIN, or payment details in chat.
- Account-specific facts: point them to /dashboard/orders, /dashboard/payments, /dashboard/receipts, /dashboard/profile, /dashboard/shipping, /dashboard/favorites, /dashboard/estimates. You cannot look those records up.
- Only link public site paths (starting with /). Never mention /admin.

Conduct:
- If they use abuse, slurs, or sexual language, refuse calmly. Do not repeat the language. Offer to continue on a respectful topic.
- If the visitor is off-topic (weather, sports, homework, medical or legal advice, coding), politely decline and offer a human on this thread.

Do not claim you have already handed them to a person unless they asked. Say a teammate can join this same chat if needed.

Return JSON only: {"reply":"string","offTopic":boolean}

Platform knowledge:
${knowledgePackForLlm()}

Contact (public only): ${LEGAL_COMPANY.phone} · ${LEGAL_COMPANY.supportEmail} · ${LEGAL_COMPANY.officeAddress} · Monday to Saturday, 8:30 AM to 5:30 PM (GMT)
`;

export async function generateLiveSupportReply(
  input: AssistantGenerateInput,
): Promise<AssistantGenerateResult> {
  const fallback = fallbackAssistantReply(input);
  const incoming = input.userText || "";
  if (looksInappropriate(incoming) || looksSensitiveProbe(incoming) || looksPaidWorkRequest(incoming)) {
    return fallback;
  }
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
  const viewerLine =
    input.viewer === "customer"
      ? "Viewer: signed-in customer. Still do not look up or invent their private records."
      : "Viewer: guest (no account required). They can browse and chat; checkout and dashboard need sign-in.";

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
            content: `${viewerLine}\n\n${history ? `Recent thread:\n${history}\n\n` : ""}Latest customer message:\n${userText}`,
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
