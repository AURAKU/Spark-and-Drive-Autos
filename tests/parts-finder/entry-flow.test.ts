import assert from "node:assert/strict";
import test from "node:test";

import { resolvePartsFinderEntryDestination } from "@/lib/parts-finder/entry-flow";

test("entry flow routes unauthenticated users to auth-aware login", () => {
  const route = resolvePartsFinderEntryDestination("UNAUTHENTICATED");
  assert.equal(route, "/login?callbackUrl=%2Fparts-finder%2Fentry");
});

test("entry flow routes active members to search", () => {
  const route = resolvePartsFinderEntryDestination("ACTIVE");
  assert.equal(route, "/parts-finder/search");
});

test("entry flow routes expired members to renewal path", () => {
  const route = resolvePartsFinderEntryDestination("EXPIRED");
  assert.equal(route, "/parts-finder/activate?status=renew");
});

test("entry flow routes pending/suspended states to activation guidance", () => {
  assert.equal(
    resolvePartsFinderEntryDestination("PENDING_PAYMENT"),
    "/parts-finder/activate?status=pending-payment",
  );
  assert.equal(
    resolvePartsFinderEntryDestination("PENDING_APPROVAL"),
    "/parts-finder/activate?status=pending-payment",
  );
  assert.equal(
    resolvePartsFinderEntryDestination("SUSPENDED"),
    "/parts-finder/activate?status=suspended",
  );
});
