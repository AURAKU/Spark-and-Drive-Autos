import assert from "node:assert/strict";
import test from "node:test";

import { normalizePartsQuery } from "@/lib/parts-finder/normalize-query";
import { rankAndSummarizeExternal } from "@/lib/parts-finder/rank-and-summarize";

test("ranking penalizes contradictory fitment and weak context", () => {
  const normalized = normalizePartsQuery({
    brand: "Toyota",
    model: "Corolla",
    year: 2017,
    partDescription: "front left control arm",
  });

  const ranked = rankAndSummarizeExternal(
    normalized,
    [
      {
        title: "Toyota Corolla rear right control arm 2012",
        snippet: "fitment 2012 rear right",
        sourceHint: "example.com",
        ingestionSource: "SERPER_WEB",
        thumbnailUrl: null,
        matchTokens: ["toyota", "corolla", "rear", "right"],
        fitmentClues: ["2012", "rear", "right"],
        evidenceSignature: "sig-1",
      },
    ],
    "u1",
  );

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].confidenceLabel, "NEEDS_VERIFICATION");
  assert.ok((ranked[0].scoreBreakdown?.fitmentContradictionPenalty ?? 0) > 0);
});

test("verified history boost never overrides contradictory evidence", () => {
  const normalized = normalizePartsQuery({
    brand: "Toyota",
    model: "Corolla",
    year: 2017,
    partDescription: "front left control arm",
  });

  const ranked = rankAndSummarizeExternal(
    normalized,
    [
      {
        title: "Toyota Corolla rear right control arm 2012",
        snippet: "fitment 2012 rear right",
        sourceHint: "example.com",
        ingestionSource: "SERPER_WEB",
        thumbnailUrl: null,
        matchTokens: ["toyota", "corolla", "rear", "right"],
        fitmentClues: ["2012", "rear", "right"],
        evidenceSignature: "sig-verified",
      },
    ],
    "u1",
    {
      signatureBoostMap: new Map([["sig-verified", 8]]),
      exactPositive: 2,
      exactLikely: 1,
      exactRejected: 0,
    },
  );

  assert.equal(ranked.length, 1);
  const learningBoost = Number((ranked[0].metadataJson?.learningBoost as number | undefined) ?? 0);
  assert.equal(learningBoost, 0);
  assert.equal(ranked[0].confidenceLabel, "NEEDS_VERIFICATION");
});

test("similar vehicle learning gives only soft bounded boost", () => {
  const normalized = normalizePartsQuery({
    brand: "Toyota",
    model: "Corolla",
    year: 2018,
    partDescription: "front left control arm",
  });

  const ranked = rankAndSummarizeExternal(
    normalized,
    [
      {
        title: "Toyota Corolla 2018 front left control arm",
        snippet: "fitment 2018 front left oem style",
        sourceHint: "example.com",
        ingestionSource: "SERPER_WEB",
        thumbnailUrl: null,
        matchTokens: ["toyota", "corolla", "front", "left", "control", "arm"],
        fitmentClues: ["2018", "front", "left"],
        evidenceSignature: "sig-soft",
      },
    ],
    "u1",
    {
      signatureBoostMap: new Map(),
      similarSignatureBoostMap: new Map([["sig-soft", 2]]),
      exactPositive: 0,
      exactLikely: 0,
      exactRejected: 0,
      similarPositive: 1,
      similarLikely: 0,
      similarRejected: 0,
    },
  );

  assert.equal(ranked.length, 1);
  const learningBoost = Number((ranked[0].metadataJson?.learningBoost as number | undefined) ?? 0);
  assert.equal(learningBoost, 2);
  assert.equal((ranked[0].metadataJson?.learningContext as { similarPositive?: number } | undefined)?.similarPositive, 1);
});

test("ranking returns unique reference images and part function summary", () => {
  const normalized = normalizePartsQuery({
    brand: "Toyota",
    model: "Corolla",
    year: 2018,
    partDescription: "front left control arm",
  });

  const ranked = rankAndSummarizeExternal(
    normalized,
    [
      {
        title: "Toyota Corolla 2018 front left control arm OEM style",
        snippet: "fitment 2018 front left suspension arm image",
        sourceHint: "example.com",
        ingestionSource: "SERPER_WEB",
        thumbnailUrl: "https://img.example.com/a.jpg",
        matchTokens: ["toyota", "corolla", "front", "left", "control", "arm"],
        fitmentClues: ["2018", "front", "left"],
        evidenceSignature: "sig-img-a",
      },
      {
        title: "Corolla control arm front left assembly",
        snippet: "toyota corolla control arm image listing",
        sourceHint: "example.com",
        ingestionSource: "SERPER_WEB",
        thumbnailUrl: "https://img.example.com/b.jpg",
        matchTokens: ["toyota", "corolla", "front", "left", "control", "arm"],
        fitmentClues: ["2018"],
        evidenceSignature: "sig-img-b",
      },
    ],
    "u1",
  );

  assert.equal(ranked.length, 2);
  assert.ok((ranked[0].images?.length ?? 0) >= 2);
  assert.ok((ranked[0].images?.length ?? 0) <= 3);
  assert.ok((ranked[0].partFunctionSummary ?? "").length > 20);
});
