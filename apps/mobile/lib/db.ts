import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "@grimoire/core/schema";

const DB_NAME = "grimoire.db";

const expoDb = openDatabaseSync(DB_NAME, { enableChangeListener: true });

expoDb.execSync("PRAGMA journal_mode = WAL;");
expoDb.execSync("PRAGMA foreign_keys = ON;");

export const db = drizzle(expoDb, { schema });

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS \`profiles\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`username\` text NOT NULL,
  \`display_name\` text NOT NULL,
  \`created_at\` integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS \`profiles_username_unique\` ON \`profiles\` (\`username\`);

CREATE TABLE IF NOT EXISTS \`character_profiles\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`owner_user_id\` text NOT NULL,
  \`name\` text NOT NULL,
  \`summary\` text,
  \`body\` text,
  \`attrs\` text,
  \`status\` text DEFAULT 'active' NOT NULL,
  \`created_at\` integer NOT NULL,
  FOREIGN KEY (\`owner_user_id\`) REFERENCES \`profiles\`(\`id\`)
);
CREATE INDEX IF NOT EXISTS \`character_profiles_owner_idx\` ON \`character_profiles\` (\`owner_user_id\`);

CREATE TABLE IF NOT EXISTS \`campaigns\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL,
  \`system_tag\` text,
  \`settings\` text,
  \`status\` text DEFAULT 'active' NOT NULL,
  \`created_at\` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS \`memberships\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`campaign_id\` text NOT NULL,
  \`user_id\` text NOT NULL,
  \`role\` text NOT NULL,
  \`character_profile_id\` text,
  \`joined_at\` integer NOT NULL,
  FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`),
  FOREIGN KEY (\`user_id\`) REFERENCES \`profiles\`(\`id\`),
  FOREIGN KEY (\`character_profile_id\`) REFERENCES \`character_profiles\`(\`id\`)
);
CREATE UNIQUE INDEX IF NOT EXISTS \`memberships_campaign_user_idx\` ON \`memberships\` (\`campaign_id\`,\`user_id\`);
CREATE INDEX IF NOT EXISTS \`memberships_user_idx\` ON \`memberships\` (\`user_id\`);

CREATE TABLE IF NOT EXISTS \`entities\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`campaign_id\` text NOT NULL,
  \`kind\` text NOT NULL,
  \`name\` text NOT NULL,
  \`summary\` text,
  \`body\` text,
  \`attrs\` text,
  \`visibility\` text DEFAULT 'table' NOT NULL,
  \`character_profile_id\` text,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL,
  FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`),
  FOREIGN KEY (\`character_profile_id\`) REFERENCES \`character_profiles\`(\`id\`)
);
CREATE INDEX IF NOT EXISTS \`entities_campaign_idx\` ON \`entities\` (\`campaign_id\`);
CREATE INDEX IF NOT EXISTS \`entities_campaign_kind_idx\` ON \`entities\` (\`campaign_id\`,\`kind\`);

CREATE TABLE IF NOT EXISTS \`entity_links\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`campaign_id\` text NOT NULL,
  \`from_type\` text NOT NULL,
  \`from_id\` text NOT NULL,
  \`to_entity_id\` text NOT NULL,
  \`context_snippet\` text,
  FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`),
  FOREIGN KEY (\`to_entity_id\`) REFERENCES \`entities\`(\`id\`)
);
CREATE UNIQUE INDEX IF NOT EXISTS \`entity_links_edge_idx\` ON \`entity_links\` (\`from_type\`,\`from_id\`,\`to_entity_id\`);
CREATE INDEX IF NOT EXISTS \`entity_links_to_idx\` ON \`entity_links\` (\`to_entity_id\`);
CREATE INDEX IF NOT EXISTS \`entity_links_campaign_idx\` ON \`entity_links\` (\`campaign_id\`);

CREATE TABLE IF NOT EXISTS \`sessions\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`campaign_id\` text NOT NULL,
  \`number\` integer NOT NULL,
  \`title\` text,
  \`played_on\` text,
  \`body\` text,
  \`status\` text DEFAULT 'planned' NOT NULL,
  FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`)
);
CREATE UNIQUE INDEX IF NOT EXISTS \`sessions_campaign_number_idx\` ON \`sessions\` (\`campaign_id\`,\`number\`);

CREATE TABLE IF NOT EXISTS \`recaps\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`session_id\` text NOT NULL,
  \`body\` text,
  \`tone\` text DEFAULT 'plain' NOT NULL,
  \`share_slug\` text NOT NULL,
  \`published_at\` integer,
  FOREIGN KEY (\`session_id\`) REFERENCES \`sessions\`(\`id\`)
);
CREATE UNIQUE INDEX IF NOT EXISTS \`recaps_share_slug_unique\` ON \`recaps\` (\`share_slug\`);
CREATE INDEX IF NOT EXISTS \`recaps_session_idx\` ON \`recaps\` (\`session_id\`);

CREATE TABLE IF NOT EXISTS \`recap_events\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`recap_id\` text NOT NULL,
  \`kind\` text NOT NULL,
  \`occurred_at\` integer NOT NULL,
  \`visitor_hash\` text,
  FOREIGN KEY (\`recap_id\`) REFERENCES \`recaps\`(\`id\`)
);
CREATE INDEX IF NOT EXISTS \`recap_events_recap_idx\` ON \`recap_events\` (\`recap_id\`);

CREATE TABLE IF NOT EXISTS \`journals\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`character_profile_id\` text NOT NULL,
  \`campaign_id\` text,
  \`body\` text,
  \`created_at\` integer NOT NULL,
  FOREIGN KEY (\`character_profile_id\`) REFERENCES \`character_profiles\`(\`id\`),
  FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`)
);
CREATE INDEX IF NOT EXISTS \`journals_character_idx\` ON \`journals\` (\`character_profile_id\`);

CREATE TABLE IF NOT EXISTS \`reveals\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`entity_id\` text NOT NULL,
  \`block_ref\` text,
  \`revealed_to\` text NOT NULL,
  \`revealed_to_user_id\` text,
  \`revealed_at\` integer NOT NULL,
  FOREIGN KEY (\`entity_id\`) REFERENCES \`entities\`(\`id\`),
  FOREIGN KEY (\`revealed_to_user_id\`) REFERENCES \`profiles\`(\`id\`)
);
CREATE INDEX IF NOT EXISTS \`reveals_entity_idx\` ON \`reveals\` (\`entity_id\`);

CREATE TABLE IF NOT EXISTS \`media\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`campaign_id\` text NOT NULL,
  \`url\` text NOT NULL,
  \`kind\` text NOT NULL,
  \`owner_entity_id\` text,
  FOREIGN KEY (\`campaign_id\`) REFERENCES \`campaigns\`(\`id\`),
  FOREIGN KEY (\`owner_entity_id\`) REFERENCES \`entities\`(\`id\`)
);
CREATE INDEX IF NOT EXISTS \`media_campaign_idx\` ON \`media\` (\`campaign_id\`);

CREATE TABLE IF NOT EXISTS \`sync_log\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`table_name\` text NOT NULL,
  \`row_id\` text NOT NULL,
  \`op\` text NOT NULL,
  \`updated_at\` integer NOT NULL,
  \`device_id\` text NOT NULL
);
CREATE INDEX IF NOT EXISTS \`sync_log_row_idx\` ON \`sync_log\` (\`table_name\`,\`row_id\`);
`;

let migrated = false;

export function applyMigrations(): void {
  if (migrated) return;
  const statements = MIGRATION_SQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  expoDb.withTransactionSync(() => {
    for (const stmt of statements) {
      expoDb.execSync(stmt + ";");
    }
  });
  migrated = true;
}
