import { supabase } from "./supabase";
import type { RecapData } from "../app/r/[slug]/page";

export async function fetchRecapBySlug(
  slug: string,
): Promise<RecapData | null> {
  if (!supabase) return null;

  const { data: recap } = await supabase
    .from("recaps")
    .select(
      `
      id,
      body,
      tone,
      published_at,
      session:sessions!inner (
        number,
        title,
        played_on,
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

  const session = recap.session as any;
  const campaign = session?.campaign;

  return {
    campaignName: campaign?.name ?? "Unknown Campaign",
    sessionNumber: session?.number ?? 0,
    sessionTitle: session?.title ?? null,
    tone: recap.tone ?? "plain",
    body: extractBodyText(recap.body),
    playedOn: session?.played_on ?? null,
  };
}

function extractBodyText(body: unknown): string {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return "";
  const doc = body as { content?: Array<{ content?: Array<{ text?: string }> }> };
  if (!doc.content) return "";
  return doc.content
    .map((block) =>
      (block.content ?? []).map((inline) => inline.text ?? "").join(""),
    )
    .filter(Boolean)
    .join("\n\n");
}

export async function logRecapEvent(
  recapId: string,
  kind: "open" | "share" | "return",
  visitorHash: string | null,
): Promise<void> {
  if (!supabase) return;
  await supabase.from("recap_events").insert({
    id: crypto.randomUUID(),
    recap_id: recapId,
    kind,
    occurred_at: Date.now(),
    visitor_hash: visitorHash,
  });
}
