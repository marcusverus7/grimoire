import { supabase } from "./supabase";
import type { RecapData } from "../app/r/[slug]/page";

const SAFE_SLUG = /^[a-zA-Z0-9_-]+$/;

export async function fetchRecapBySlug(
  slug: string,
): Promise<RecapData | null> {
  if (!supabase || !SAFE_SLUG.test(slug)) return null;

  const { data: recap } = await supabase
    .from("recaps")
    .select(
      `
      id,
      body,
      tone,
      published_at,
      session:sessions!inner (
        id,
        number,
        title,
        played_on,
        campaign_id,
        campaign:campaigns!inner (
          name
        )
      )
    `,
    )
    .eq("share_slug", slug)
    .not("published_at", "is", null)
    .single();

  if (!recap) return null;

  const session = recap.session as unknown as { id: string; number: number; title: string | null; played_on: string | null; campaign_id: string; campaign: { name: string } } | undefined;
  const campaign = session?.campaign;

  // Fetch quotes for this session — gracefully returns [] if table doesn't exist yet
  let quotes: { text: string; attribution?: string | null }[] = [];
  if (session?.id) {
    try {
      const { data: quotesData } = await supabase
        .from("quotes")
        .select("text, attribution")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true });
      if (quotesData) quotes = quotesData;
    } catch {
      // quotes table not yet migrated — ignore
    }
  }

  return {
    campaignName: campaign?.name ?? "Unknown Campaign",
    sessionNumber: session?.number ?? 0,
    sessionTitle: session?.title ?? null,
    tone: recap.tone ?? "plain",
    body: extractBodyText(recap.body),
    playedOn: session?.played_on ?? null,
    quotes,
  };
}

type RTNode = { type?: string; text?: string; content?: RTNode[]; attrs?: Record<string, unknown> };

function inlineText(node: RTNode): string {
  if (node.text != null) return node.text;
  if (node.type === "mention") return `@${String(node.attrs?.["label"] ?? "")}`;
  return (node.content ?? []).map(inlineText).join("");
}

function extractBodyText(body: unknown): string {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return "";
  const doc = body as RTNode;
  if (!doc.content) return "";
  return doc.content
    .map((block) => {
      switch (block.type) {
        case "heading": return inlineText(block);
        case "paragraph": return inlineText(block);
        case "blockquote": return (block.content ?? []).map(inlineText).join(" ");
        case "bulletList":
          return (block.content ?? []).map((li) => `• ${inlineText(li)}`).join("\n");
        case "orderedList":
          return (block.content ?? []).map((li, i) => `${i + 1}. ${inlineText(li)}`).join("\n");
        default: return inlineText(block);
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

export async function logRecapEvent(
  recapId: string,
  kind: "open" | "share" | "return",
  visitorHash: string | null,
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("recap_events").insert({
      id: crypto.randomUUID(),
      recap_id: recapId,
      kind,
      occurred_at: Date.now(),
      visitor_hash: visitorHash,
    });
  } catch {
    // Analytics failure should never break the user experience
  }
}
