import type { Metadata } from "next";
import { BRAND, installUrl, hasInstallLink } from "../lib/site";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description:
    "Grimoire is a campaign memory system for tabletop RPGs. Track every NPC, quest and quote, then share beautiful session recaps.",
};

export default function HomePage() {
  return (
    <main style={styles.container}>
      <div style={styles.seal}>
        <span style={styles.sealLetter}>G</span>
      </div>

      <h1 style={styles.brand}>{BRAND.name}</h1>
      <p style={styles.tagline}>{BRAND.tagline}</p>

      <div style={styles.rule} />

      <p style={styles.lede}>
        A campaign memory system for tabletop RPGs. Capture every NPC, quest and
        quote as you play — then turn a session into a recap worth sharing.
      </p>

      <ul style={styles.features}>
        <li style={styles.feature}>
          <strong style={styles.featureTitle}>Remember everything.</strong> NPCs,
          factions, locations and items, linked by @-mentions as you write.
        </li>
        <li style={styles.feature}>
          <strong style={styles.featureTitle}>Recaps in seconds.</strong> Generate
          a &ldquo;Previously on…&rdquo; and share a link like the one your GM sent you.
        </li>
        <li style={styles.feature}>
          <strong style={styles.featureTitle}>Your data is yours.</strong> Full
          Markdown + JSON export, free forever. No lock-in.
        </li>
      </ul>

      <div style={styles.ctaRow}>
        <a href={installUrl()} style={styles.primaryCta}>
          {hasInstallLink() ? "Get Grimoire →" : "Coming soon to iOS →"}
        </a>
        <a href="/r/demo" style={styles.secondaryCta}>
          See a sample recap
        </a>
      </div>

      <div style={styles.rule} />
      <p style={styles.footNote}>
        Campaigns belong to the whole group. Players are always free.
      </p>
    </main>
  );
}

const styles = {
  container: {
    maxWidth: 640,
    margin: "2.5rem auto" as const,
    padding: "3rem 2.25rem",
    backgroundColor: BRAND.parchment,
    backgroundImage: "url(/textures/parchment-bg.png)",
    backgroundSize: "cover",
    backgroundPosition: "center",
    borderRadius: 6,
    border: "1px solid #5a3d23",
    boxShadow: "0 12px 48px rgba(0,0,0,0.55)",
    color: BRAND.ink,
    textAlign: "center" as const,
  },
  seal: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    backgroundColor: BRAND.oxblood,
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    border: `2px solid ${BRAND.goldBright}`,
    marginBottom: "1.25rem",
  },
  sealLetter: {
    fontSize: 32,
    fontWeight: "bold" as const,
    color: "#F5EFDE",
    fontFamily: "serif",
  },
  brand: {
    fontFamily: "'Cinzel Decorative', serif",
    fontSize: "1.6rem",
    color: BRAND.gold,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    margin: "0 0 0.5rem",
  },
  tagline: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontStyle: "italic" as const,
    fontSize: "1.15rem",
    color: BRAND.inkSoft,
    margin: "0 0 1.5rem",
  },
  rule: {
    height: 1,
    background: `linear-gradient(to right, transparent, ${BRAND.gold}, transparent)`,
    margin: "1.5rem 0",
  },
  lede: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: "1.25rem",
    lineHeight: 1.5,
    color: BRAND.ink,
    margin: "0 auto 2rem",
    maxWidth: 460,
  },
  features: {
    listStyle: "none" as const,
    padding: 0,
    margin: "0 auto 2rem",
    maxWidth: 460,
    textAlign: "left" as const,
  },
  feature: {
    fontFamily: "'Inter', sans-serif",
    fontSize: "0.92rem",
    lineHeight: 1.6,
    color: BRAND.inkSoft,
    marginBottom: "1rem",
    paddingLeft: "1.1rem",
    borderLeft: `2px solid rgba(160, 122, 44, 0.35)`,
  },
  featureTitle: {
    color: BRAND.ink,
  },
  ctaRow: {
    display: "flex" as const,
    gap: "1rem",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexWrap: "wrap" as const,
    marginBottom: "0.5rem",
  },
  primaryCta: {
    display: "inline-block" as const,
    padding: "0.75rem 1.6rem",
    backgroundColor: BRAND.oxblood,
    color: "#F5EFDE",
    textDecoration: "none" as const,
    borderRadius: 3,
    border: `1px solid ${BRAND.goldBright}`,
    fontFamily: "'Inter', sans-serif",
    fontWeight: 600,
    fontSize: "0.9rem",
    letterSpacing: "0.04em",
  },
  secondaryCta: {
    fontFamily: "'Inter', sans-serif",
    fontSize: "0.85rem",
    color: BRAND.gold,
    textDecoration: "none" as const,
    borderBottom: `1px solid rgba(160, 122, 44, 0.3)`,
    paddingBottom: 2,
  },
  footNote: {
    fontFamily: "'Inter', sans-serif",
    fontSize: "0.72rem",
    color: "rgba(44, 32, 20, 0.5)",
    margin: 0,
  },
};
