/**
 * Single source of truth for campaign-scoped `app_kv` data.
 *
 * The GM-utility screens (clues, clocks, party bonds, timeline, loot, …) store
 * their state as JSON blobs in the mobile app's `app_kv` table under keys like
 * `clues_${campaignId}`. Nothing about those keys lived in core, which is how
 * they came to be silently dropped from both export ("your data is always
 * yours" — principle 6) and campaign delete (orphaned rows left behind forever).
 *
 * This registry fixes both from one place: export reads it to include the data,
 * delete reads it to enumerate the keys to remove. Adding a new GM tool means
 * adding one entry here — then export and delete both cover it automatically.
 */

export type KvScope = "campaign" | "session";

export interface CampaignKvNamespace {
  /** Stable id used as the JSON export key. */
  id: string;
  /** Human label for the Markdown export. */
  label: string;
  /** Key prefix; full key is `${prefix}${campaignId}` (or `${sessionId}`). */
  prefix: string;
  /** Whether the key is scoped to the campaign or to each of its sessions. */
  scope: KvScope;
  /**
   * In-play ephemeral state (current combat round, staged encounter). Deleted
   * with the campaign but excluded from export — it is not durable player data.
   */
  transient?: boolean;
  /**
   * Handled by a dedicated exporter elsewhere (scene notes → scene-notes/ dir),
   * so it is enumerated for delete but skipped by the generic export renderer.
   */
  exportedElsewhere?: boolean;
}

export const CAMPAIGN_KV_NAMESPACES: readonly CampaignKvNamespace[] = [
  { id: "clues", label: "Clues", prefix: "clues_", scope: "campaign" },
  { id: "clocks", label: "Campaign Clocks", prefix: "clocks_", scope: "campaign" },
  { id: "bonds", label: "Party Bonds", prefix: "bonds_", scope: "campaign" },
  { id: "todos", label: "Prep To-Dos", prefix: "todos_", scope: "campaign" },
  { id: "tables", label: "Random Tables", prefix: "rtables_", scope: "campaign" },
  { id: "timelineEvents", label: "World Timeline Events", prefix: "timeline_events_", scope: "campaign" },
  { id: "calendar", label: "Calendar & Events", prefix: "calendar_", scope: "campaign" },
  { id: "loot", label: "Loot History", prefix: "loot_history_", scope: "campaign" },
  { id: "magicItems", label: "Magic Items", prefix: "magic_items_", scope: "campaign" },
  { id: "injuries", label: "Injuries", prefix: "injuries_", scope: "campaign" },
  { id: "downtime", label: "Downtime Activities", prefix: "downtime_", scope: "campaign" },
  { id: "reputation", label: "Reputation", prefix: "reputation_", scope: "campaign" },
  { id: "spellSlots", label: "Spell Slots", prefix: "spell_slots_", scope: "campaign" },
  // Transient in-play state — deleted with the campaign, never exported.
  { id: "encounter", label: "Staged Encounter", prefix: "encounter_", scope: "campaign", transient: true },
  { id: "trackerRound", label: "Combat Round", prefix: "tracker_round_", scope: "campaign", transient: true },
  // Scene notes are session-scoped and exported to scene-notes/ by the app.
  { id: "sceneNotes", label: "Scene Notes", prefix: "session_notes_", scope: "session", exportedElsewhere: true },
] as const;

/**
 * Every `app_kv` key belonging to a campaign — campaign-scoped and
 * session-scoped, transient included. This is the delete manifest: pass a
 * campaign id and its session ids to get the exact keys to remove.
 */
export function campaignKvKeys(campaignId: string, sessionIds: readonly string[]): string[] {
  const keys: string[] = [];
  for (const ns of CAMPAIGN_KV_NAMESPACES) {
    if (ns.scope === "campaign") {
      keys.push(`${ns.prefix}${campaignId}`);
    } else {
      for (const sid of sessionIds) keys.push(`${ns.prefix}${sid}`);
    }
  }
  return keys;
}

/** Namespaces that the generic export renderer should emit (durable, not handled elsewhere). */
export function exportableCampaignNamespaces(): CampaignKvNamespace[] {
  return CAMPAIGN_KV_NAMESPACES.filter(
    (ns) => ns.scope === "campaign" && !ns.transient && !ns.exportedElsewhere,
  );
}

/** A GM-tool value ready for export: the namespace id and its already-parsed JSON. */
export interface GmToolData {
  id: string;
  value: unknown;
}

const TITLE_FIELDS = ["name", "title", "label", "text", "note", "activity"] as const;

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function renderScalar(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

/** Best-effort readable Markdown for an arbitrary GM-tool JSON blob. */
export function renderGmToolMarkdown(label: string, value: unknown): string {
  const lines = [`## ${label}`, ""];
  const items = Array.isArray(value) ? value : value != null ? [value] : [];
  if (items.length === 0) return "";

  for (const item of items) {
    if (item == null) continue;
    if (typeof item !== "object") {
      lines.push(`- ${renderScalar(item)}`);
      continue;
    }
    const obj = item as Record<string, unknown>;
    const titleKey = TITLE_FIELDS.find((k) => typeof obj[k] === "string" && obj[k] !== "");
    const title = titleKey ? String(obj[titleKey]) : "Entry";
    lines.push(`- **${title}**`);
    for (const [k, v] of Object.entries(obj)) {
      if (k === titleKey || k === "id" || v == null || v === "") continue;
      if (Array.isArray(v)) {
        if (v.length === 0) continue;
        lines.push(`  - ${humanizeKey(k)}: ${v.map(renderScalar).filter(Boolean).join(", ")}`);
      } else if (typeof v === "object") {
        lines.push(`  - ${humanizeKey(k)}: ${JSON.stringify(v)}`);
      } else {
        lines.push(`  - ${humanizeKey(k)}: ${renderScalar(v)}`);
      }
    }
  }
  lines.push("");
  return lines.join("\n");
}
