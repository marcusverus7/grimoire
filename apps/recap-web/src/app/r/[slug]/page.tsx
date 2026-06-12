import type { Metadata } from "next";
import { RecapView } from "./recap-view";
import { fetchRecapBySlug } from "../../../lib/recaps";

interface RecapPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: RecapPageProps): Promise<Metadata> {
  const { slug } = await params;
  const recap = await resolveRecap(slug);

  const title = recap
    ? `${recap.campaignName} — Session ${recap.sessionNumber}`
    : "Recap Not Found";

  const description = recap
    ? `Session ${recap.sessionNumber} recap from ${recap.campaignName}`
    : "A session recap from The Grimoire Archive";
  const bodyPreview = recap ? recap.body.slice(0, 200) : "Relive the adventure";

  return {
    title: `${title} — The Grimoire Archive`,
    description,
    openGraph: {
      title,
      description: bodyPreview,
      type: "article",
      siteName: "The Grimoire Archive",
    },
    twitter: {
      card: "summary",
      title,
      description: bodyPreview,
    },
  };
}

export default async function RecapPage({ params }: RecapPageProps) {
  const { slug } = await params;
  const recap = await resolveRecap(slug);

  if (!recap) {
    return (
      <main style={styles.container}>
        <div style={styles.centered}>
          <div style={styles.seal}>
            <span style={styles.sealLetter}>G</span>
          </div>
          <h1 style={styles.heading}>Recap Not Found</h1>
          <p style={styles.subtitle}>
            The recap <code style={styles.code}>{slug}</code> doesn&apos;t exist
            or hasn&apos;t been published yet.
          </p>
          <a href="/" style={styles.link}>
            Return to The Grimoire Archive
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <RecapView recap={recap} />
    </main>
  );
}

export interface RecapData {
  campaignName: string;
  sessionNumber: number;
  sessionTitle?: string | null;
  tone: string;
  body: string;
  playedOn?: string | null;
}

async function resolveRecap(slug: string): Promise<RecapData | null> {
  if (slug === "demo") return DEMO_RECAP;
  return fetchRecapBySlug(slug);
}

const DEMO_RECAP: RecapData = {
  campaignName: "The Sunken Throne",
  sessionNumber: 7,
  sessionTitle: "The Siege of Ashford",
  tone: "epic",
  playedOn: "2025-06-08",
  body: `The drums began at dawn. From the ramparts of Ashford, our heroes watched the Thornbound host emerge from the morning mist — a thousand strong, their banner the black briar on grey. Commander Varga had promised reinforcements from the river gate, but the river gate was ash and silence.

Kael drew first blood, an impossible shot from the bell tower that felled the enemy's siege captain mid-command. The assault faltered for one precious minute — enough for Sister Maren to complete the ward that held the eastern wall through three charges. But wards do not last forever, and the Thornbound brought something older than wards.

When the breach came, it came with a sound like the earth splitting. Lyra threw herself into the gap, shield raised against the ram-beast the enemy had unleashed — a creature of root and rage that no blade could bite. It was Theron's desperate invocation to the drowned god that turned the tide: saltwater erupted from the well in the courtyard, and the beast screamed as the brine unmade its bindings.

Ashford held. Barely. As the Thornbound retreated into the evening fog, Varga's riders finally appeared on the southern road — too late for glory, but perhaps not too late for what comes next.

The ward-stones are cracked, and Sister Maren says they cannot be renewed. Whatever the Thornbound bring next, they will bring it through an open gate.`,
};

const styles = {
  container: {
    maxWidth: 640,
    margin: "0 auto" as const,
    padding: "2rem 1.5rem",
    minHeight: "100vh",
  } as const,
  centered: {
    display: "flex" as const,
    flexDirection: "column" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    minHeight: "60vh",
    textAlign: "center" as const,
  },
  seal: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    backgroundColor: "#7A2418",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    border: "2px solid #C9A24A",
    marginBottom: "1.5rem",
  },
  sealLetter: {
    fontSize: 28,
    fontWeight: "bold" as const,
    color: "#F5EFDE",
    fontFamily: "serif",
  },
  heading: {
    fontFamily: "'Cinzel Decorative', serif",
    fontSize: "1.2rem",
    color: "#A07A2C",
    letterSpacing: "0.1em",
    marginBottom: "0.75rem",
  },
  subtitle: {
    color: "#ECE3CF",
    opacity: 0.6,
    marginBottom: "1.5rem",
    lineHeight: 1.6,
  },
  code: {
    backgroundColor: "rgba(160, 122, 44, 0.1)",
    padding: "0.15em 0.4em",
    borderRadius: 3,
    fontSize: "0.9em",
    fontFamily: "monospace",
  },
  link: {
    color: "#A07A2C",
    textDecoration: "none" as const,
    borderBottom: "1px solid rgba(160, 122, 44, 0.3)",
    paddingBottom: 2,
    fontSize: "0.9rem",
  },
};
