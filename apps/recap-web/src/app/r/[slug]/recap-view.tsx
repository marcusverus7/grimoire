"use client";

import type { RecapData } from "./page";

export function RecapView({ recap }: { recap: RecapData }) {
  const paragraphs = recap.body
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const heading = recap.sessionTitle
    ? `Previously on ${recap.campaignName} — Session ${recap.sessionNumber}: ${recap.sessionTitle}`
    : `Previously on ${recap.campaignName} — Session ${recap.sessionNumber}`;

  return (
    <article>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.seal}>
          <span style={styles.sealLetter}>G</span>
        </div>
        <p style={styles.campaignLabel}>{recap.campaignName}</p>
        <h1 style={styles.heading}>{heading}</h1>
        {recap.playedOn && (
          <time style={styles.date} dateTime={recap.playedOn}>
            {formatDate(recap.playedOn)}
          </time>
        )}
        <div style={styles.rule} />
      </header>

      {/* Body */}
      <div style={styles.body}>
        {paragraphs.map((p, i) => {
          const isHook = i === paragraphs.length - 1;
          return (
            <p
              key={i}
              style={{
                ...styles.paragraph,
                ...(isHook ? styles.hookParagraph : {}),
              }}
            >
              {i === 0 && <span style={styles.dropCap}>{p[0]}</span>}
              {i === 0 ? p.slice(1) : p}
            </p>
          );
        })}
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.rule} />
        <div style={styles.footerContent}>
          <div style={styles.toneTag}>
            {recap.tone}
          </div>
          <p style={styles.footerText}>
            Recorded in{" "}
            <span style={styles.footerBrand}>The Grimoire Archive</span>
          </p>
        </div>
      </footer>
    </article>
  );
}

function formatDate(iso: string): string {
  const parts = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return iso;
  const [, year, month, day] = parts;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const m = months[parseInt(month!, 10) - 1] ?? "";
  return `${m} ${day}, ${year}`;
}

const styles = {
  header: {
    textAlign: "center" as const,
    marginBottom: "2.5rem",
  },
  seal: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    backgroundColor: "#7A2418",
    display: "inline-flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    border: "2px solid #C9A24A",
    marginBottom: "1rem",
  },
  sealLetter: {
    fontSize: 20,
    fontWeight: "bold" as const,
    color: "#F5EFDE",
    fontFamily: "serif",
  },
  campaignLabel: {
    fontFamily: "'Cinzel Decorative', serif",
    fontSize: "0.7rem",
    color: "#A07A2C",
    letterSpacing: "0.2em",
    textTransform: "uppercase" as const,
    margin: "0 0 0.75rem",
  },
  heading: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#ECE3CF",
    lineHeight: 1.35,
    margin: "0 0 0.75rem",
  },
  date: {
    display: "block" as const,
    fontFamily: "'Inter', sans-serif",
    fontSize: "0.75rem",
    color: "rgba(236, 227, 207, 0.4)",
    letterSpacing: "0.05em",
    marginBottom: "1.5rem",
  },
  rule: {
    height: 1,
    background: "linear-gradient(to right, transparent, #A07A2C, transparent)",
  },
  body: {
    lineHeight: 1.8,
    fontSize: "1.05rem",
    color: "#ECE3CF",
  },
  paragraph: {
    margin: "0 0 1.25rem",
    textIndent: 0,
  },
  hookParagraph: {
    fontStyle: "italic" as const,
    color: "rgba(236, 227, 207, 0.75)",
    borderLeft: "2px solid #A07A2C",
    paddingLeft: "1rem",
    marginTop: "1.5rem",
  },
  dropCap: {
    float: "left" as const,
    fontSize: "3.2rem",
    lineHeight: 0.8,
    fontFamily: "'Cinzel Decorative', serif",
    color: "#A07A2C",
    paddingRight: "0.15em",
    paddingTop: "0.1em",
  },
  footer: {
    marginTop: "3rem",
  },
  footerContent: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginTop: "1rem",
  },
  toneTag: {
    fontFamily: "'Inter', sans-serif",
    fontSize: "0.65rem",
    color: "rgba(160, 122, 44, 0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.15em",
    border: "1px solid rgba(160, 122, 44, 0.2)",
    padding: "0.2em 0.6em",
    borderRadius: 3,
  },
  footerText: {
    fontFamily: "'Inter', sans-serif",
    fontSize: "0.7rem",
    color: "rgba(236, 227, 207, 0.3)",
    margin: 0,
  },
  footerBrand: {
    color: "#A07A2C",
  },
};
