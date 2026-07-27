import { NextRequest, NextResponse } from "next/server";
import { guardRecapRequest } from "@/lib/api-guard";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Publishes a recap from the mobile app so its share link actually resolves.
 *
 * The app is local-first: recaps live in on-device SQLite, but /r/[slug] reads
 * from Supabase. Until this endpoint existed nothing ever bridged the two, so
 * every share link the app generated was a 404. The GM's share action now
 * POSTs the minimal public payload here; we upsert with the service-role
 * client (RLS keeps anon strictly read-only).
 *
 * Guarded like generate-recap: shared app token + per-IP rate limit, plus
 * size caps. Upserts are idempotent — re-sharing re-publishes.
 */

const MAX_TEXT = 200;
const MAX_BODY_JSON = 100_000; // recap rich-text JSON, stringified
const MAX_QUOTES = 50;

interface PublishPayload {
  campaign: { id: string; name: string; systemTag?: string | null };
  session: {
    id: string;
    campaignId: string;
    number: number;
    title?: string | null;
    playedOn?: string | null;
  };
  recap: {
    id: string;
    sessionId: string;
    body: unknown;
    tone: string;
    shareSlug: string;
  };
  quotes?: { id: string; text: string; attribution?: string | null }[];
}

const ID_RX = /^[a-zA-Z0-9_-]{1,64}$/;
const SLUG_RX = /^[a-zA-Z0-9_-]{4,64}$/;

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  const gate = guardRecapRequest(req.headers);
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const admin = supabaseAdmin();
  if (!admin) return bad("Publishing is not configured on the server", 503);

  let p: PublishPayload;
  try {
    p = (await req.json()) as PublishPayload;
  } catch {
    return bad("Invalid request body");
  }

  // Structural validation — every id user-controlled, so shape-check hard.
  if (!p?.campaign?.id || !p?.session?.id || !p?.recap?.id) return bad("Missing campaign/session/recap");
  for (const [label, id] of [
    ["campaign.id", p.campaign.id],
    ["session.id", p.session.id],
    ["recap.id", p.recap.id],
  ] as const) {
    if (!ID_RX.test(id)) return bad(`Invalid ${label}`);
  }
  if (!SLUG_RX.test(p.recap.shareSlug)) return bad("Invalid share slug");
  if (p.session.campaignId !== p.campaign.id || p.recap.sessionId !== p.session.id) {
    return bad("Mismatched ids");
  }
  if (!p.campaign.name || p.campaign.name.length > MAX_TEXT) return bad("Invalid campaign name");
  if ((p.session.title?.length ?? 0) > MAX_TEXT) return bad("Session title too long");
  if (!Number.isInteger(p.session.number) || p.session.number < 0 || p.session.number > 10_000) {
    return bad("Invalid session number");
  }
  if (JSON.stringify(p.recap.body ?? null).length > MAX_BODY_JSON) return bad("Recap body too large", 413);
  const quotes = (p.quotes ?? []).slice(0, MAX_QUOTES);
  for (const q of quotes) {
    if (!ID_RX.test(q.id) || !q.text || q.text.length > 500) return bad("Invalid quote");
    if ((q.attribution?.length ?? 0) > MAX_TEXT) return bad("Quote attribution too long");
  }

  // The slug must not already belong to a different recap (slugs are the
  // public capability — collisions would leak someone else's page).
  const { data: slugOwner } = await admin
    .from("recaps")
    .select("id")
    .eq("share_slug", p.recap.shareSlug)
    .maybeSingle();
  if (slugOwner && slugOwner.id !== p.recap.id) return bad("Slug already in use", 409);

  const now = Date.now();

  const { error: campErr } = await admin.from("campaigns").upsert(
    {
      id: p.campaign.id,
      name: p.campaign.name,
      system_tag: p.campaign.systemTag ?? null,
      created_at: now,
    },
    { onConflict: "id", ignoreDuplicates: false },
  );
  if (campErr) return bad(`Campaign publish failed: ${campErr.message}`, 500);

  const { error: sessErr } = await admin.from("sessions").upsert(
    {
      id: p.session.id,
      campaign_id: p.campaign.id,
      number: p.session.number,
      title: p.session.title ?? null,
      played_on: p.session.playedOn ?? null,
      status: "played",
    },
    { onConflict: "id" },
  );
  if (sessErr) return bad(`Session publish failed: ${sessErr.message}`, 500);

  const { error: recapErr } = await admin.from("recaps").upsert(
    {
      id: p.recap.id,
      session_id: p.session.id,
      body: p.recap.body ?? null,
      tone: p.recap.tone || "plain",
      share_slug: p.recap.shareSlug,
      published_at: now,
    },
    { onConflict: "id" },
  );
  if (recapErr) return bad(`Recap publish failed: ${recapErr.message}`, 500);

  if (quotes.length > 0) {
    const { error: quoteErr } = await admin.from("quotes").upsert(
      quotes.map((q, i) => ({
        id: q.id,
        campaign_id: p.campaign.id,
        session_id: p.session.id,
        text: q.text,
        attribution: q.attribution ?? null,
        created_at: now + i, // preserve order under the viewer's created_at sort
      })),
      { onConflict: "id" },
    );
    if (quoteErr) return bad(`Quotes publish failed: ${quoteErr.message}`, 500);
  }

  return NextResponse.json({ ok: true, url: `/r/${p.recap.shareSlug}` });
}
