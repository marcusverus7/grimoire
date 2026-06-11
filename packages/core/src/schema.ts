/**
 * Grimoire database schema — identical shape in local SQLite (expo-sqlite)
 * and Postgres (Supabase) so backup/sync is a transport problem, not a remodel.
 *
 * Ownership doctrine (Strategic Plan v2.0, Part II §7):
 *  - Campaigns belong to the GROUP: there is no campaigns.owner_id; ownership
 *    lives in `memberships` and the GM seat is a role that can transfer.
 *  - Characters belong to PLAYERS: `character_profiles` (the passport) is
 *    owned by a user and exists independently of any campaign.
 */
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).notNull();

/** One row per user; mirrors auth provider. */
export const profiles = sqliteTable("profiles", {
  id: id(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: createdAt(),
});

/**
 * The character passport. Owned by the player, independent of campaigns.
 * Retiring/archiving never destroys it; it can be imported into a new
 * campaign by linking a membership + a `pc` entity to it.
 */
export const characterProfiles = sqliteTable(
  "character_profiles",
  {
    id: id(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => profiles.id),
    name: text("name").notNull(),
    summary: text("summary"),
    body: text("body", { mode: "json" }),
    attrs: text("attrs", { mode: "json" }),
    status: text("status", { enum: ["active", "retired", "archived"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
  },
  (t) => [index("character_profiles_owner_idx").on(t.ownerUserId)],
);

export const campaigns = sqliteTable("campaigns", {
  id: id(),
  name: text("name").notNull(),
  /** Free text — system-agnostic from day one. */
  systemTag: text("system_tag"),
  settings: text("settings", { mode: "json" }),
  status: text("status", { enum: ["active", "archived", "ended"] })
    .notNull()
    .default("active"),
  createdAt: createdAt(),
});

/**
 * Roles, succession, and the passport link. Exactly one `gm` row per
 * campaign is an application invariant (see permissions.ts), not a DB
 * constraint, because succession transitions must be atomic swaps.
 */
export const memberships = sqliteTable(
  "memberships",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    role: text("role", { enum: ["gm", "co_gm", "player"] }).notNull(),
    characterProfileId: text("character_profile_id").references(
      () => characterProfiles.id,
    ),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("memberships_campaign_user_idx").on(t.campaignId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

/**
 * The campaign graph's nodes. One polymorphic table, many kinds, so the
 * graph stays simple and new kinds are data, not migrations.
 */
export const entities = sqliteTable(
  "entities",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    kind: text("kind", {
      enum: ["npc", "pc", "location", "faction", "item", "quest", "custom"],
    }).notNull(),
    name: text("name").notNull(),
    summary: text("summary"),
    body: text("body", { mode: "json" }),
    /** Kind-specific fields, e.g. quest { status: "rumoured" | "active" | "complete" | "failed" }. */
    attrs: text("attrs", { mode: "json" }),
    visibility: text("visibility", { enum: ["gm_only", "table"] })
      .notNull()
      .default("table"),
    /** A `pc` entity links to its passport; the player owns it through this. */
    characterProfileId: text("character_profile_id").references(
      () => characterProfiles.id,
    ),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("entities_campaign_idx").on(t.campaignId),
    index("entities_campaign_kind_idx").on(t.campaignId, t.kind),
  ],
);

/**
 * The graph's edges — written automatically by @-mentions (linking.ts);
 * powers backlinks and the relationship graph. Never hand-edited.
 */
export const entityLinks = sqliteTable(
  "entity_links",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    fromType: text("from_type", { enum: ["entity", "session"] }).notNull(),
    fromId: text("from_id").notNull(),
    toEntityId: text("to_entity_id")
      .notNull()
      .references(() => entities.id),
    contextSnippet: text("context_snippet"),
  },
  (t) => [
    uniqueIndex("entity_links_edge_idx").on(t.fromType, t.fromId, t.toEntityId),
    index("entity_links_to_idx").on(t.toEntityId),
    index("entity_links_campaign_idx").on(t.campaignId),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    number: integer("number").notNull(),
    title: text("title"),
    playedOn: text("played_on"), // ISO date; the timeline is ORDER BY number
    body: text("body", { mode: "json" }),
    status: text("status", { enum: ["planned", "played"] })
      .notNull()
      .default("planned"),
  },
  (t) => [
    uniqueIndex("sessions_campaign_number_idx").on(t.campaignId, t.number),
  ],
);

/** Shareable recap pages — the growth loop. */
export const recaps = sqliteTable(
  "recaps",
  {
    id: id(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    body: text("body", { mode: "json" }),
    tone: text("tone", { enum: ["plain", "epic", "noir", "comedy"] })
      .notNull()
      .default("plain"),
    shareSlug: text("share_slug").notNull().unique(),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("recaps_session_idx").on(t.sessionId)],
);

/**
 * Recap analytics from the very first page — opens, shares, return visits.
 * The recap is the growth engine; this table is the growth dashboard.
 */
export const recapEvents = sqliteTable(
  "recap_events",
  {
    id: id(),
    recapId: text("recap_id")
      .notNull()
      .references(() => recaps.id),
    kind: text("kind", { enum: ["open", "share", "return"] }).notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    /** Salted hash, never an IP — enough to distinguish open vs return. */
    visitorHash: text("visitor_hash"),
  },
  (t) => [index("recap_events_recap_idx").on(t.recapId)],
);

/** Player journals — owned via the passport, not the campaign. */
export const journals = sqliteTable(
  "journals",
  {
    id: id(),
    characterProfileId: text("character_profile_id")
      .notNull()
      .references(() => characterProfiles.id),
    /** Optional: which campaign the entry was written during. */
    campaignId: text("campaign_id").references(() => campaigns.id),
    body: text("body", { mode: "json" }),
    createdAt: createdAt(),
  },
  (t) => [index("journals_character_idx").on(t.characterProfileId)],
);

/** Progressive reveal (V1, designed now): GM-only blocks revealed by tap. */
export const reveals = sqliteTable(
  "reveals",
  {
    id: id(),
    entityId: text("entity_id")
      .notNull()
      .references(() => entities.id),
    /** Null = the whole entity; otherwise a block id inside the rich body. */
    blockRef: text("block_ref"),
    revealedTo: text("revealed_to", { enum: ["table", "user"] }).notNull(),
    revealedToUserId: text("revealed_to_user_id").references(() => profiles.id),
    revealedAt: integer("revealed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("reveals_entity_idx").on(t.entityId)],
);

/** Media arrives in V1 (images deferred from MVP); quotas gate the paid tier. */
export const media = sqliteTable(
  "media",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    url: text("url").notNull(),
    kind: text("kind").notNull(),
    ownerEntityId: text("owner_entity_id").references(() => entities.id),
  },
  (t) => [index("media_campaign_idx").on(t.campaignId)],
);

/** Backup snapshots first; last-write-wins bookkeeping when sync arrives. */
export const syncLog = sqliteTable(
  "sync_log",
  {
    id: id(),
    tableName: text("table_name").notNull(),
    rowId: text("row_id").notNull(),
    op: text("op", { enum: ["insert", "update", "delete"] }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deviceId: text("device_id").notNull(),
  },
  (t) => [index("sync_log_row_idx").on(t.tableName, t.rowId)],
);
