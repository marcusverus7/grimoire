export const colors = {
  leather: { DEFAULT: "#1A1410", light: "#2A2118" },
  parchment: { DEFAULT: "#F2E8D5", deep: "#E8DBBF", light: "#FAF5EA", warm: "#EDE0C8" },
  gold: { DEFAULT: "#8B6914", muted: "#A68530", bright: "#C49A2C" },
  oxblood: { DEFAULT: "#7A2418", light: "#9A3428" },
  ink: { DEFAULT: "#2C2014", soft: "#5A4D3E", faint: "#8A7D6D" },
} as const;

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
 * Flat, value-preserving tokens for inline `style={{}}` colours.
 *
 * The `colors` object above mirrors tailwind.config.ts (e.g. gold #8B6914). But
 * the app's hundreds of inline hexes use DRIFTED values — inline "gold" is
 * #A07A2C, not #8B6914. `color` below captures the values actually rendered, so
 * replacing a raw inline hex with a token changes nothing visually. Migrate
 * inline styles to these; reconciling the two gold palettes is a separate,
 * deliberate design decision for later.
 */
export const color = {
  parchment: "#FAF5EA",
  parchmentWarm: "#F5EDD8",
  parchmentEdge: "#E8DCC8",
  paperWhite: "#F5EFDE",

  ink: "#2C2014",
  inkSoft: "#5A4D3E",
  inkFaint: "#8A7D6D",

  gold: "#A07A2C",
  goldBright: "#C9A24A",

  oxblood: "#7A2418",
  oxbloodLight: "#9A3428",

  border: "#C4B49A",
  borderDark: "#4A3F32",

  success: "#4A8060",
  successBright: "#2D7A4F",
  arcane: "#6A5ACD",

  shadow: "#000000",
} as const;

export type ColorToken = keyof typeof color;

/**
 * Apply an alpha channel to a token as #RRGGBBAA (React Native accepts this).
 * Replaces the pervasive inline `"#A07A2C" + "40"` / `"#A07A2C40"` pattern.
 *
 *   withAlpha("gold", 0.25) → "#A07A2C40"
 */
export function withAlpha(token: ColorToken, alpha: number): string {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${color[token]}${a}`;
}
