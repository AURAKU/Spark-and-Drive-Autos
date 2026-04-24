import assert from "node:assert/strict";
import test from "node:test";

import { parseExternalCandidates } from "@/lib/parts-finder/result-parser";

test("parser strips noise and deduplicates robustly", () => {
  const parsed = parseExternalCandidates([
    {
      title: "Toyota control arm buy now",
      snippet: "free shipping click here",
      sourceHint: "example.com",
      ingestionSource: "SERPER_WEB",
      thumbnailUrl: null,
      oemReferences: ["48068ABCD12"],
    },
    {
      title: "Toyota control arm buy now",
      snippet: "free shipping click here",
      sourceHint: "example.com",
      ingestionSource: "SERPER_WEB",
      thumbnailUrl: null,
      oemReferences: ["48068ABCD12"],
    },
  ]);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title.includes("buy now"), false);
  assert.equal(parsed[0].snippet.includes("free shipping"), false);
});
