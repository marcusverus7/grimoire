/**
 * Shared brand + call-to-action config for recap-web.
 *
 * Every shared recap reaches a whole table of people who don't have the app —
 * the cheapest acquisition channel Grimoire has. The recap footer links here,
 * to the landing page, which carries the real store buttons. Store URLs are
 * env-driven so we can point them at TestFlight now and the App Store later
 * without a code change.
 */

export const BRAND = {
  name: "The Grimoire Archive", // working title
  tagline: "Write Your Story. Live Your Legend.",
  parchment: "#EAD9B0",
  desk: "#1A1410",
  ink: "#2C2014",
  inkSoft: "#5A4D3E",
  gold: "#A07A2C",
  goldBright: "#C9A24A",
  oxblood: "#7A2418",
} as const;

/** Public TestFlight beta invite link, if one is live. */
export const TESTFLIGHT_URL = process.env.NEXT_PUBLIC_TESTFLIGHT_URL ?? "";
/** App Store listing, once published. */
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "";

/**
 * Best available install destination. Prefer the App Store, then TestFlight;
 * if neither is configured yet, fall back to the landing page itself so the
 * recap CTA always resolves to something real.
 */
export function installUrl(): string {
  return APP_STORE_URL || TESTFLIGHT_URL || "/";
}

/** Is a real store/beta link configured (vs. the "coming soon" fallback)? */
export function hasInstallLink(): boolean {
  return Boolean(APP_STORE_URL || TESTFLIGHT_URL);
}
