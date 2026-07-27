import { eq } from "drizzle-orm";
import { db } from "./db";
import { schema } from "@grimoire/core";

/**
 * Publish a recap to recap-web's Supabase so its share link resolves.
 *
 * The app is local-first: recaps are saved to on-device SQLite, but the public
 * viewer at grimoire-recap-web.vercel.app/r/[slug] reads from Supabase. Every
 * surface that hands out a share link (recap create/update, the recap library,
 * session detail's Share button) must call this first — historically none did,
 * so every link ever shared was a 404.
 *
 * Idempotent server-side upsert: re-publishing the same recap refreshes it.
 */

const PUBLISH_API = "https://grimoire-recap-web.vercel.app/api/publish-recap";

export interface PublishResult {
  ok: boolean;
  /** Human-readable reason when not ok. */
  error?: string;
}

export async function publishRecap(recapId: string): Promise<PublishResult> {
  try {
    const recap = db
      .select()
      .from(schema.recaps)
      .where(eq(schema.recaps.id, recapId))
      .get();
    if (!recap) return { ok: false, error: "Recap not found on device" };

    const session = db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, recap.sessionId))
      .get();
    if (!session) return { ok: false, error: "Session not found on device" };

    const campaign = db
      .select()
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, session.campaignId))
      .get();
    if (!campaign) return { ok: false, error: "Campaign not found on device" };

    const quotes = db
      .select()
      .from(schema.quotes)
      .where(eq(schema.quotes.sessionId, session.id))
      .all();

    const res = await fetch(PUBLISH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.EXPO_PUBLIC_RECAP_APP_TOKEN
          ? { "x-grimoire-app-token": process.env.EXPO_PUBLIC_RECAP_APP_TOKEN }
          : {}),
      },
      body: JSON.stringify({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          systemTag: campaign.systemTag ?? null,
        },
        session: {
          id: session.id,
          campaignId: session.campaignId,
          number: session.number,
          title: session.title ?? null,
          playedOn: session.playedOn ?? null,
        },
        recap: {
          id: recap.id,
          sessionId: recap.sessionId,
          body: recap.body ?? null,
          tone: recap.tone,
          shareSlug: recap.shareSlug,
        },
        quotes: quotes.map((q) => ({
          id: q.id,
          text: q.text,
          attribution: q.attribution ?? null,
        })),
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error — are you online?",
    };
  }
}

/** The public URL for a recap slug (single source of truth for link text). */
export function recapShareUrl(slug: string): string {
  return `grimoire-recap-web.vercel.app/r/${slug}`;
}
