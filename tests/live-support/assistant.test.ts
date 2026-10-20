import assert from "node:assert/strict";
import test from "node:test";

import {
  fallbackAssistantReply,
  isHumanHandlingThread,
  looksOffTopic,
  matchKnowledgeTopic,
  sanitizeAssistantReply,
  SPARK_ASSISTANT_LABEL,
  STAFF_ACTIVE_MS,
} from "@/lib/live-support-assistant";

test("platform questions match a knowledge topic", () => {
  const duty = matchKnowledgeTopic("How does import duty and GRA clearance work?");
  assert.equal(duty?.id, "duty");
  const wallet = matchKnowledgeTopic("Can I pay from my wallet balance?");
  assert.equal(wallet?.id, "wallet");
  const finder = matchKnowledgeTopic("How do I use Parts Finder with a VIN?");
  assert.equal(finder?.id, "parts-finder");
});

test("off-topic questions are declined and still offer a human", () => {
  assert.equal(looksOffTopic("What's the weather in Accra today?"), true);
  const r = fallbackAssistantReply({ userText: "Write me a poem about Manchester United" });
  assert.equal(r.offTopic, true);
  assert.equal(r.usedLlm, false);
  assert.match(r.reply, /teammate/i);
  assert.doesNotMatch(r.reply.toLowerCase(), /manchester|poem/);
});

test("fallback replies never invent prices or duty amounts", () => {
  const r = fallbackAssistantReply({ userText: "How much duty will I pay on a 2018 Camry?" });
  assert.match(r.reply.toLowerCase(), /never quote|not a gra|authorities|teammate/);
  assert.doesNotMatch(r.reply, /GHS\s*\d/);
});

test("attachment-only messages get a natural handoff note", () => {
  const r = fallbackAssistantReply({ userText: "", hasAttachments: true });
  assert.match(r.reply, /file/i);
  assert.match(r.reply, /teammate/i);
});

test("human handoff is on when an agent is assigned and recently active", () => {
  const now = new Date("2026-10-20T10:00:00.000Z");
  assert.equal(
    isHumanHandlingThread({
      adminId: "admin_1",
      lastAdminAt: new Date(now.getTime() - 5 * 60 * 1000),
      now,
    }),
    true,
  );
  assert.equal(
    isHumanHandlingThread({
      adminId: "admin_1",
      lastAdminAt: new Date(now.getTime() - STAFF_ACTIVE_MS - 1000),
      now,
    }),
    false,
  );
  assert.equal(isHumanHandlingThread({ adminId: null, lastAdminAt: now, now }), false);
});

test("sanitize strips model leaks and keeps a usable reply", () => {
  const cleaned = sanitizeAssistantReply("As an AI I can help. See https://openai.com/foo and /cars");
  assert.doesNotMatch(cleaned.toLowerCase(), /as an ai/);
  assert.doesNotMatch(cleaned, /openai\.com/);
  assert.ok(cleaned.length > 0);
  assert.equal(SPARK_ASSISTANT_LABEL, "Spark assistant");
});
