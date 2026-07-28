import { useSyncExternalStore } from "react";
import { colorScheme as nativewindColorScheme } from "nativewind";

/**
 * Grimoire has two themes:
 *
 *   parchment  (light) — aged paper, dark ink. The original look.
 *   candlelit  (dark)  — dark leather, warm ink. For GMs running night games.
 *
 * Both palettes below are keyed identically. The *light* values are
 * byte-identical to what shipped before this file grew a second palette, so
 * turning the feature on changes nothing for anyone who stays on parchment.
 *
 * ## Why there are four kinds of colour token
 *
 * A theme switch is not a global invert. The same hex plays different roles:
 * `#2C2014` is body text on most screens but the *background* of the dice
 * sheet. Inverting both breaks one of them. So tokens are grouped by role and
 * only two of the four groups actually flip:
 *
 *   fg       — ink on parchment. Flips dark → light.
 *   surface  — paper the ink sits on. Flips light → dark.
 *   panel    — surfaces that are deliberately dark in *both* themes
 *              (the dice sheet, leather chrome). Never flips.
 *   onAccent — text/icons sitting on a dark accent (oxblood buttons, gold
 *              chips). Already light in both themes. Never flips.
 *   accent   — hues (gold, oxblood, success…). Hue preserved, brightened for
 *              candlelit so it still reads against a dark ground.
 *
 * Pick by role, not by which hex happens to match.
 */

export type Scheme = "parchment" | "candlelit";

export const SCHEME_LABEL: Record<Scheme, string> = {
  parchment: "Parchment",
  candlelit: "Candlelit",
};

const parchmentPalette = {
  // ── fg: ink on paper (flips) ────────────────────────────────────────────
  ink: "#2C2014",
  inkSoft: "#5A4D3E",
  inkFaint: "#8A7D6D",
  inkStone: "#7A6E60",
  inkBark: "#3A2E24",
  borderDark: "#4A3F32",

  // ── surface: the paper itself (flips) ───────────────────────────────────
  parchment: "#FAF5EA",
  parchmentBase: "#F2E8D5",
  parchmentWarm: "#F5EDD8",
  parchmentEdge: "#E8DCC8",
  parchmentCard: "#ECE3CF",
  parchmentDeep: "#E8DBBF",
  parchmentSand: "#E0D4BC",
  paperWhite: "#F5EFDE",
  paperBright: "#FFFDF7",
  paperBrightWarm: "#FFFDF8",
  paperCream: "#FAF0DC",
  canvas: "#EAD9B0",
  border: "#C4B49A",
  sand: "#C8B88A",

  // ── panel: dark in BOTH themes (never flips) ────────────────────────────
  panelLeather: "#1A1410",
  panelLeatherLight: "#2A2118",
  panelBark: "#3A2E24",
  panelInk: "#2C2014",
  panelInkSoft: "#5A4D3E",
  panelInkFaint: "#8A7D6D",
  panelBorderDark: "#4A3F32",

  // ── onAccent: light in BOTH themes (never flips) ────────────────────────
  onAccent: "#FAF5EA",
  onAccentSoft: "#F5EFDE",
  onAccentWarm: "#F5EDD8",
  onAccentMuted: "#ECE3CF",
  onAccentFaint: "#E0D4BC",
  onAccentBright: "#FFFDF7",
  onAccentBrightWarm: "#FFFDF8",
  onAccentEdge: "#E8DCC8",
  onAccentDeep: "#E8DBBF",
  onAccentBase: "#F2E8D5",
  onAccentCream: "#FAF0DC",
  onAccentCanvas: "#EAD9B0",
  onAccentSand: "#C8B88A",
  onAccentBorder: "#C4B49A",

  // ── accent: hue kept, brightened for candlelit ──────────────────────────
  gold: "#A07A2C",
  goldBright: "#C9A24A",
  /**
   * WCAG-AA gold for FUNCTIONAL text. `gold` is 3.6:1 against parchment — fine
   * for ornament, below the 4.5:1 minimum for the small uppercase labels it was
   * being used on. Same hue, darkened. Use goldText for text people must read,
   * gold for decoration. (In candlelit it lightens instead, same reason.)
   */
  goldText: "#8A6A24",
  goldDeep: "#8B6914",
  goldMuted: "#A68530",
  goldPale: "#D4A843",
  goldDark: "#8A5C1A",
  goldEarth: "#7A5020",
  goldShadow: "#5C4A2A",

  oxblood: "#7A2418",
  oxbloodLight: "#9A3428",
  crimson: "#7A1A1A",
  crimsonBright: "#8B2020",
  crimsonDark: "#8A1A1A",
  crimsonDeep: "#3A0A0A",
  ember: "#C44A1A",

  success: "#4A8060",
  successBright: "#2D7A4F",
  green: "#4A7A2C",
  greenDark: "#3A6830",
  greenDeep: "#1A6A4A",
  greenDeepest: "#0A4A30",

  arcane: "#6A5ACD",
  violet: "#7C3AED",
  violetPale: "#B0A0E0",
  purpleDeep: "#5A3A7A",
  purpleDark: "#4A3A7A",
  purpleNight: "#1A1430",

  teal: "#1E6B6B",
  blue: "#2563EB",
  blueDeep: "#2A4080",

  shadow: "#000000",
} as const;

export type ColorToken = keyof typeof parchmentPalette;

const candlelitPalette: Record<ColorToken, string> = {
  // fg — warm candle-lit ink, never pure white (that reads as a screen, not paper)
  ink: "#EFE4CE",
  inkSoft: "#C0B096",
  inkFaint: "#93866F",
  inkStone: "#9C8F7D",
  inkBark: "#D6C6A8",
  borderDark: "#7C6B54",

  // surface — dark leather, warmed so it never goes blue-black
  parchment: "#1C1611",
  parchmentBase: "#16110D",
  parchmentWarm: "#221A13",
  parchmentEdge: "#2A2119",
  parchmentCard: "#241C15",
  parchmentDeep: "#2A2119",
  parchmentSand: "#302518",
  paperWhite: "#1F1812",
  paperBright: "#241C14",
  paperBrightWarm: "#241C14",
  paperCream: "#221A13",
  canvas: "#14100C",
  border: "#4C4133",
  sand: "#55492F",

  // panel — unchanged; these surfaces were always dark
  panelLeather: "#1A1410",
  panelLeatherLight: "#2A2118",
  panelBark: "#3A2E24",
  panelInk: "#2C2014",
  panelInkSoft: "#5A4D3E",
  panelInkFaint: "#8A7D6D",
  panelBorderDark: "#4A3F32",

  // onAccent — unchanged; these sit on accents, which are dark in both themes
  onAccent: "#FAF5EA",
  onAccentSoft: "#F5EFDE",
  onAccentWarm: "#F5EDD8",
  onAccentMuted: "#ECE3CF",
  onAccentFaint: "#E0D4BC",
  onAccentBright: "#FFFDF7",
  onAccentBrightWarm: "#FFFDF8",
  onAccentEdge: "#E8DCC8",
  onAccentDeep: "#E8DBBF",
  onAccentBase: "#F2E8D5",
  onAccentCream: "#FAF0DC",
  onAccentCanvas: "#EAD9B0",
  onAccentSand: "#C8B88A",
  onAccentBorder: "#C4B49A",

  // accent — same hue, lifted so it carries against dark leather
  gold: "#C9A24A",
  goldBright: "#E2BE73",
  goldText: "#D9B45E",
  goldDeep: "#B98F2E",
  goldMuted: "#C3A257",
  goldPale: "#E4C069",
  goldDark: "#B4813A",
  goldEarth: "#A87A44",
  goldShadow: "#8A7450",

  oxblood: "#A03A2A",
  oxbloodLight: "#B84C39",
  crimson: "#A83A31",
  crimsonBright: "#B94538",
  crimsonDark: "#B53E33",
  crimsonDeep: "#3A0A0A",
  ember: "#DA6B3C",

  success: "#6FB68C",
  successBright: "#4FBE85",
  green: "#7EB257",
  greenDark: "#6BA25F",
  greenDeep: "#3FA97E",
  greenDeepest: "#0A4A30",

  arcane: "#9A8CF0",
  violet: "#A882F5",
  violetPale: "#C8B9F2",
  purpleDeep: "#8B65AE",
  purpleDark: "#7A6AAE",
  purpleNight: "#1A1430",

  teal: "#4FA8A8",
  blue: "#6C97F5",
  blueDeep: "#5B79C4",

  shadow: "#000000",
};

/**
 * Live palette. Mutated in place by `applyScheme` so the ~1,400 existing
 * `color.x` call sites keep working untouched — they read the current value on
 * every render. Components re-render because they call `useThemeTick()`.
 */
export const color: Record<ColorToken, string> = { ...parchmentPalette };

/** Nested palette mirroring tailwind.config.ts, used by the navigator chrome. */
const parchmentNested = {
  leather: { DEFAULT: "#1A1410", light: "#2A2118" },
  parchment: { DEFAULT: "#F2E8D5", deep: "#E8DBBF", light: "#FAF5EA", warm: "#EDE0C8" },
  gold: { DEFAULT: "#8B6914", muted: "#A68530", bright: "#C49A2C" },
  oxblood: { DEFAULT: "#7A2418", light: "#9A3428" },
  ink: { DEFAULT: "#2C2014", soft: "#5A4D3E", faint: "#8A7D6D" },
};

const candlelitNested: typeof parchmentNested = {
  leather: { DEFAULT: "#241C14", light: "#322619" },
  parchment: { DEFAULT: "#16110D", deep: "#2A2119", light: "#1C1611", warm: "#241C15" },
  gold: { DEFAULT: "#C9A24A", muted: "#C3A257", bright: "#E2BE73" },
  oxblood: { DEFAULT: "#A03A2A", light: "#B84C39" },
  ink: { DEFAULT: "#EFE4CE", soft: "#C0B096", faint: "#93866F" },
};

export const colors: typeof parchmentNested = {
  leather: { ...parchmentNested.leather },
  parchment: { ...parchmentNested.parchment },
  gold: { ...parchmentNested.gold },
  oxblood: { ...parchmentNested.oxblood },
  ink: { ...parchmentNested.ink },
};

export const fonts = {
  cinzel: "CinzelDecorative_400Regular",
  cinzelBold: "CinzelDecorative_700Bold",
  cormorant: "CormorantGaramond_400Regular",
  cormorantItalic: "CormorantGaramond_400Regular_Italic",
  cormorantSemibold: "CormorantGaramond_600SemiBold",
  cormorantBold: "CormorantGaramond_700Bold",
  inter: "Inter_400Regular",
  interMedium: "Inter_500Medium",
  interSemibold: "Inter_600SemiBold",
} as const;

/**
 * Apply an alpha channel to a token as #RRGGBBAA (React Native accepts this).
 * Reads the live palette, so it follows the active theme.
 *
 *   withAlpha("gold", 0x40 / 255) → "#A07A2C40" on parchment, "#C9A24A40" on candlelit
 */
export function withAlpha(token: ColorToken, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${color[token]}${a}`;
}

// ── the store ─────────────────────────────────────────────────────────────

const listeners = new Set<() => void>();
let current: Scheme = "parchment";

export function getScheme(): Scheme {
  return current;
}

export function isCandlelit(): boolean {
  return current === "candlelit";
}

/**
 * Swap the palette. Mutates `color`/`colors` in place, flips NativeWind's
 * colour scheme (which drives every `dark:` className), then wakes every
 * component subscribed via `useThemeTick`.
 */
export function applyScheme(next: Scheme): void {
  current = next;
  const flat = next === "candlelit" ? candlelitPalette : parchmentPalette;
  Object.assign(color, flat);
  const nested = next === "candlelit" ? candlelitNested : parchmentNested;
  (Object.keys(nested) as (keyof typeof nested)[]).forEach((group) => {
    Object.assign(colors[group], nested[group]);
  });
  nativewindColorScheme.set(next === "candlelit" ? "dark" : "light");
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Subscribe a component to theme changes.
 *
 * Call it once at the top of any component that reads `color.*`, `withAlpha`
 * or a `dark:` className. Without it the component keeps whatever colours it
 * rendered with — React has no reason to re-run it when a plain object mutates.
 */
export function useThemeTick(): Scheme {
  return useSyncExternalStore(subscribe, getScheme, getScheme);
}

/** `useThemeTick` plus the answer, for components that branch on the theme. */
export function useIsCandlelit(): boolean {
  return useThemeTick() === "candlelit";
}

export const THEME_KV_KEY = "app_theme_scheme";

export function parseScheme(raw: string | null | undefined): Scheme {
  return raw === "candlelit" ? "candlelit" : "parchment";
}
