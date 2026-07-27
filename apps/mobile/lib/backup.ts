import { eq } from "drizzle-orm";
import { db, getKv } from "./db";
import { supabase } from "./supabase";
import {
  schema,
  exportCampaign,
  exportableCampaignNamespaces,
} from "@grimoire/core";
import type { RichTextNode, GmToolData } from "@grimoire/core";

/**
 * Real cloud backup — pushes a complete campaign snapshot to Supabase.
 *
 * The payload is the export JSON (format grimoire-export v2), which since the
 * campaignData manifest includes every GM-tool namespace — so a backup is
 * exactly as complete as an export. Rows live in the `backups` table, RLS
 * limits access to the owning auth user, and the app talks to it with the
 * user's own JWT (no service keys on-device).
 */

export interface CloudBackupRow {
  id: string;
  campaign_id: string;
  campaign_name: string;
  size_bytes: number;
  created_at: number;
}

export interface BackupResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

/**
 * Restore the cached auth session onto the supabase client. The client is
 * created with persistSession=false (the app persists the session itself in
 * kv), so before any authed PostgREST call we must hand the tokens back.
 * Guest/demo sessions have no real tokens and are rejected here with a
 * friendly message rather than a server error.
 */
async function withAuthedClient(): Promise<BackupResult<string>> {
  const raw = getKv("supabase_session");
  if (!raw) return { ok: false, error: "Sign in to use cloud backup." };
  let cached: { access_token?: string; refresh_token?: string; user?: { id?: string } };
  try {
    cached = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Sign in to use cloud backup." };
  }
  if (!cached.access_token || !cached.refresh_token || !cached.user?.id) {
    return { ok: false, error: "Cloud backup needs a real account — you're in guest mode. Sign in first." };
  }
  const { data, error } = await supabase.auth.setSession({
    access_token: cached.access_token,
    refresh_token: cached.refresh_token,
  });
  if (error || !data.session) {
    return { ok: false, error: "Your session has expired. Sign out and back in, then retry." };
  }
  return { ok: true, data: data.session.user.id };
}

function buildSnapshot(campaignId: string): { json: string; campaignName: string } | null {
  const campaign = db.select().from(schema.campaigns).where(eq(schema.campaigns.id, campaignId)).get();
  if (!campaign) return null;

  const entities = db.select().from(schema.entities).where(eq(schema.entities.campaignId, campaignId)).all();
  const sessions = db.select().from(schema.sessions).where(eq(schema.sessions.campaignId, campaignId)).all();
  const quotes = db.select().from(schema.quotes).where(eq(schema.quotes.campaignId, campaignId)).all();

  const gmTools: GmToolData[] = [];
  for (const ns of exportableCampaignNamespaces()) {
    const raw = getKv(`${ns.prefix}${campaignId}`);
    if (!raw) continue;
    try {
      const value = JSON.parse(raw);
      if (value == null || (Array.isArray(value) && value.length === 0)) continue;
      gmTools.push({ id: ns.id, value });
    } catch {
      /* skip malformed */
    }
  }

  const settings = (campaign.settings ?? {}) as { worldNotes?: RichTextNode };
  const result = exportCampaign({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      systemTag: campaign.systemTag ?? undefined,
      status: campaign.status,
    },
    entities: entities.map((e) => ({
      id: e.id,
      kind: e.kind,
      name: e.name,
      summary: e.summary,
      body: e.body as RichTextNode | null,
      attrs: e.attrs as Record<string, unknown> | null,
      visibility: e.visibility as "gm_only" | "table",
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      number: s.number,
      title: s.title,
      playedOn: s.playedOn,
      body: s.body as RichTextNode | null,
      status: s.status as "planned" | "in_progress" | "played",
    })),
    quotes: quotes.map((q) => ({ id: q.id, attribution: q.attribution, text: q.text })),
    worldNotes: settings.worldNotes ?? null,
    gmTools,
    includeGmOnly: true,
  });

  return { json: result.json, campaignName: campaign.name };
}

export async function pushBackup(
  campaignId: string,
  backupId: string,
  appVersion: string,
): Promise<BackupResult> {
  const auth = await withAuthedClient();
  if (!auth.ok) return { ok: false, error: auth.error };

  const snapshot = buildSnapshot(campaignId);
  if (!snapshot) return { ok: false, error: "Campaign not found on device" };

  const { error } = await supabase.from("backups").insert({
    id: backupId,
    user_id: auth.data,
    campaign_id: campaignId,
    campaign_name: snapshot.campaignName,
    payload: JSON.parse(snapshot.json),
    size_bytes: snapshot.json.length,
    app_version: appVersion,
    created_at: Date.now(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listBackups(campaignId: string): Promise<BackupResult<CloudBackupRow[]>> {
  const auth = await withAuthedClient();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data, error } = await supabase
    .from("backups")
    .select("id, campaign_id, campaign_name, size_bytes, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as CloudBackupRow[] };
}

export async function deleteBackup(backupId: string): Promise<BackupResult> {
  const auth = await withAuthedClient();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error } = await supabase.from("backups").delete().eq("id", backupId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
