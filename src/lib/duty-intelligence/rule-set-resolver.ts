import { engineError } from "./errors";
import { getRuleSetByProfileId } from "./rule-sets/verified-profiles";
import type { VersionedRuleSet } from "./rule-sets/verified-profiles";

export function resolveRuleSet(params: {
  profileId: string;
  assessmentDate: Date;
}): VersionedRuleSet {
  const ruleSet = getRuleSetByProfileId(params.profileId);
  if (!ruleSet) {
    throw engineError("MISSING_RULE_SET", `No versioned rule set for profile ${params.profileId}`, {
      details: { profileId: params.profileId },
    });
  }

  const assessmentTime = params.assessmentDate.getTime();
  const from = new Date(ruleSet.effectiveFrom).getTime();
  const to = ruleSet.effectiveTo ? new Date(ruleSet.effectiveTo).getTime() : null;

  if (assessmentTime < from || (to != null && assessmentTime > to)) {
    throw engineError("MISSING_RULE_SET", `No effective rule set for assessment date ${params.assessmentDate.toISOString().slice(0, 10)}`, {
      details: { profileId: params.profileId, ruleSetVersion: ruleSet.version },
    });
  }

  const unverified = ruleSet.rules.filter((r) => r.verificationStatus !== "VERIFIED");
  if (unverified.length > 0) {
    throw engineError("UNVERIFIED_RULE", "Rule set contains unverified rules", {
      details: { chargeKeys: unverified.map((r) => r.chargeKey) },
    });
  }

  return ruleSet;
}
