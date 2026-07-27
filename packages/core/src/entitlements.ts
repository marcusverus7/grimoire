/**
 * Entitlements — the paywall's skeleton, dark-launched.
 *
 * Strategic plan Part II, engine 1 (Grimoire+ GM subscription):
 *   - Free tier: 1 active campaign, AI recaps rationed, export ALWAYS free,
 *     players ALWAYS free.
 *   - Grimoire+ (~£4.99/mo): unlimited campaigns, unlimited AI recaps, cloud
 *     backup, prep templates, secrets/GM tools.
 *
 * Nothing is charged yet. `MONETIZATION_ENABLED` is false, so every check
 * returns the unlocked answer regardless of plan — the app behaves exactly as
 * it does today. When we're ready to charge, flip the flag (and wire a real
 * `plan` from the store receipt); the gates below start applying. No screen
 * needs to learn about tiers before then — they call `can(...)` and get `true`.
 *
 * Doctrine: export is free forever (principle 4) and players are free forever
 * (principle: campaigns belong to the group). Those two are enforced here as
 * invariants — they stay allowed even when monetization is switched on.
 */

/** Master switch. While false, the app is entirely free and unlimited. */
export const MONETIZATION_ENABLED = false;

export type Plan = "free" | "plus";

export const FREE_ACTIVE_CAMPAIGN_LIMIT = 1;
/** AI recaps a free GM may generate per calendar month. */
export const FREE_MONTHLY_AI_RECAPS = 3;

export type Capability =
  | "createActiveCampaign" // subject to the free active-campaign limit
  | "generateAiRecap" // rationed on free, unlimited on plus
  | "cloudBackup" // plus only
  | "prepTemplates" // plus only
  | "secretsTools"; // plus only (GM secret notes, reveal tooling)

export interface EntitlementUsage {
  /** Non-archived campaigns the user currently owns. */
  activeCampaigns: number;
  /** AI recaps already generated this calendar month. */
  aiRecapsThisMonth: number;
}

export interface EntitlementResult {
  allowed: boolean;
  /** Present when blocked: a short reason for an upsell surface. */
  reason?: string;
}

const ALLOWED: EntitlementResult = { allowed: true };

/**
 * Can this plan perform `capability` given current usage?
 *
 * While MONETIZATION_ENABLED is false this always allows. Callers should treat
 * a blocked result as "show an upsell", never as a hard error — the free tier
 * is meant to be usable, not crippled.
 */
export function can(
  capability: Capability,
  plan: Plan,
  usage: EntitlementUsage,
): EntitlementResult {
  if (!MONETIZATION_ENABLED || plan === "plus") return ALLOWED;

  switch (capability) {
    case "createActiveCampaign":
      return usage.activeCampaigns < FREE_ACTIVE_CAMPAIGN_LIMIT
        ? ALLOWED
        : {
            allowed: false,
            reason: `Free plan supports ${FREE_ACTIVE_CAMPAIGN_LIMIT} active campaign. Archive one or upgrade to Grimoire+ for unlimited.`,
          };
    case "generateAiRecap":
      return usage.aiRecapsThisMonth < FREE_MONTHLY_AI_RECAPS
        ? ALLOWED
        : {
            allowed: false,
            reason: `You've used your ${FREE_MONTHLY_AI_RECAPS} free AI recaps this month. Upgrade to Grimoire+ for unlimited.`,
          };
    case "cloudBackup":
      return { allowed: false, reason: "Cloud backup is a Grimoire+ feature." };
    case "prepTemplates":
      return { allowed: false, reason: "Prep templates are a Grimoire+ feature." };
    case "secretsTools":
      return { allowed: false, reason: "Advanced GM tools are a Grimoire+ feature." };
    default:
      return ALLOWED;
  }
}

/** Export is free forever, on every plan — never gate this behind `can`. */
export const EXPORT_IS_FREE = true as const;
