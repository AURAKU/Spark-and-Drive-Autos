import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inferEngineCcFromText } from "@/lib/duty-intelligence/engine-cc";
import {
  GENERAL_PASSENGER_PROFILE_ID,
  VERIFIED_EV_PROFILE_ID,
  VERIFIED_ICE_PROFILE_ID,
  requireHsProfile,
  resolveHsProfile,
} from "@/lib/duty-intelligence/hs-profile-resolver";

describe("hs profile resolver", () => {
  it("reads 1.5T from model text as 1500cc", () => {
    assert.equal(inferEngineCcFromText("Jetour Traveler 1.5T 2WD"), 1500);
    assert.equal(inferEngineCcFromText("Discovery 1498cc"), 1498);
  });

  it("maps 1.5T petrol to HS 8703.22 and the Ghana passenger planning profile", () => {
    const resolved = requireHsProfile({
      fuelType: "GASOLINE_PETROL",
      engineCc: 1498,
      manufactureYear: 2023,
      make: "Jetour",
      model: "Traveler 1.5T",
    });
    assert.equal(resolved.hsCodeNormalized, "8703.22");
    assert.equal(resolved.profileId, GENERAL_PASSENGER_PROFILE_ID);
    assert.notEqual(resolved.confidence, "LOW");
  });

  it("keeps calibrated Jetour 870323 and BYD 870380 profiles", () => {
    const ice = requireHsProfile({
      hsCode: "870323",
      fuelType: "GASOLINE",
      engineCc: 1998,
      manufactureYear: 2022,
    });
    assert.equal(ice.profileId, VERIFIED_ICE_PROFILE_ID);

    const ev = requireHsProfile({
      fuelType: "ELECTRIC",
      manufactureYear: 2025,
      powerKw: 160,
    });
    assert.equal(ev.profileId, VERIFIED_EV_PROFILE_ID);
    assert.equal(ev.hsCodeNormalized, "8703.80");
  });

  it("still resolves when only make/model encode the engine size", () => {
    const resolved = resolveHsProfile({
      fuelType: "GASOLINE_PETROL",
      manufactureYear: 2024,
      make: "Jetour",
      model: "Shanghai L7 1.5T",
    });
    assert.ok(resolved);
    assert.equal(resolved!.hsCodeNormalized, "8703.22");
  });

  it("corrects a mismatched 8703.21 heading when the engine is 1.5T", () => {
    const resolved = requireHsProfile({
      hsCode: "870321",
      fuelType: "GASOLINE_PETROL",
      engineCc: 1498,
      manufactureYear: 2023,
      make: "Jetour",
      model: "Traveler",
    });
    assert.equal(resolved.hsCodeNormalized, "8703.22");
    assert.equal(resolved.profileId, GENERAL_PASSENGER_PROFILE_ID);
  });
});
