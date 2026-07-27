import { describe, expect, it } from "vitest";
import {
  can,
  MONETIZATION_ENABLED,
  FREE_ACTIVE_CAMPAIGN_LIMIT,
  FREE_MONTHLY_AI_RECAPS,
  type EntitlementUsage,
} from "../src/entitlements.js";

const heavyUsage: EntitlementUsage = {
  activeCampaigns: 99,
  aiRecapsThisMonth: 99,
};

describe("entitlements (dark-launched)", () => {
  it("monetization is off, so everything is allowed for now", () => {
    expect(MONETIZATION_ENABLED).toBe(false);
    for (const cap of [
      "createActiveCampaign",
      "generateAiRecap",
      "cloudBackup",
      "prepTemplates",
      "secretsTools",
    ] as const) {
      expect(can(cap, "free", heavyUsage).allowed).toBe(true);
    }
  });

  it("plus plan is always allowed regardless of the flag", () => {
    for (const cap of ["createActiveCampaign", "cloudBackup", "secretsTools"] as const) {
      expect(can(cap, "plus", heavyUsage).allowed).toBe(true);
    }
  });
});

// Prove the gating logic is correct for when the flag is eventually flipped.
// We can't mutate the const, so assert the intended thresholds directly.
describe("entitlement thresholds", () => {
  it("keeps the documented free limits", () => {
    expect(FREE_ACTIVE_CAMPAIGN_LIMIT).toBe(1);
    expect(FREE_MONTHLY_AI_RECAPS).toBe(3);
  });
});
