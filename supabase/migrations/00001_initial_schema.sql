-- Grimoire Supabase schema — Postgres version of the local SQLite schema.
-- This is the cloud backup/sync target. The local SQLite DB is the source of
-- truth; this Postgres schema exists for:
--   1. recap-web: fetch published recaps by share_slug
--   2. Future: cloud backup and multi-device sync
--   3. Future: shared campaign state for multiplayer

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS character_profiles (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  summary TEXT,
  body JSONB,
  attrs JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS character_profiles_owner_idx ON character_profiles(owner_user_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  system_tag TEXT,
  settings JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_id TEXT NOT NULL REFERENCES profiles(id),
  role TEXT NOT NULL,
  character_profile_id TEXT REFERENCES character_profiles(id),
  joined_at BIGINT NOT NULL,
  UNIQUE(campaign_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  summary TEXT,
  body JSONB,
  attrs JSONB,
  visibility TEXT NOT NULL DEFAULT 'table',
  character_profile_id TEXT REFERENCES character_profiles(id),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS entities_campaign_idx ON entities(campaign_id);
CREATE INDEX IF NOT EXISTS entities_campaign_kind_idx ON entities(campaign_id, kind);

CREATE TABLE IF NOT EXISTS entity_links (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  from_type TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_entity_id TEXT NOT NULL REFERENCES entities(id),
  context_snippet TEXT,
  UNIQUE(from_type, from_id, to_entity_id)
);
CREATE INDEX IF NOT EXISTS entity_links_to_idx ON entity_links(to_entity_id);
CREATE INDEX IF NOT EXISTS entity_links_campaign_idx ON entity_links(campaign_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  number INTEGER NOT NULL,
  title TEXT,
  played_on TEXT,
  body JSONB,
  status TEXT NOT NULL DEFAULT 'planned',
  UNIQUE(campaign_id, number)
);

CREATE TABLE IF NOT EXISTS recaps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  body JSONB,
  tone TEXT NOT NULL DEFAULT 'plain',
  share_slug TEXT NOT NULL UNIQUE,
  published_at BIGINT
);
CREATE INDEX IF NOT EXISTS recaps_session_idx ON recaps(session_id);

CREATE TABLE IF NOT EXISTS recap_events (
  id TEXT PRIMARY KEY,
  recap_id TEXT NOT NULL REFERENCES recaps(id),
  kind TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  visitor_hash TEXT
);
CREATE INDEX IF NOT EXISTS recap_events_recap_idx ON recap_events(recap_id);

CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY,
  character_profile_id TEXT NOT NULL REFERENCES character_profiles(id),
  campaign_id TEXT REFERENCES campaigns(id),
  body JSONB,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS journals_character_idx ON journals(character_profile_id);

CREATE TABLE IF NOT EXISTS reveals (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  block_ref TEXT,
  revealed_to TEXT NOT NULL,
  revealed_to_user_id TEXT REFERENCES profiles(id),
  revealed_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS reveals_entity_idx ON reveals(entity_id);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  url TEXT NOT NULL,
  kind TEXT NOT NULL,
  owner_entity_id TEXT REFERENCES entities(id)
);
CREATE INDEX IF NOT EXISTS media_campaign_idx ON media(campaign_id);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  op TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  device_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sync_log_row_idx ON sync_log(table_name, row_id);

-- ============================================================================
-- RLS: recap-web only needs anonymous read access to published recaps
-- and write access to recap_events (anonymous analytics).
-- ============================================================================

ALTER TABLE recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE recap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Anyone can read published recaps (published_at IS NOT NULL)
CREATE POLICY "Public can read published recaps"
  ON recaps FOR SELECT
  USING (published_at IS NOT NULL);

-- Anyone can read the session tied to a published recap
CREATE POLICY "Public can read sessions for published recaps"
  ON sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recaps
      WHERE recaps.session_id = sessions.id
      AND recaps.published_at IS NOT NULL
    )
  );

-- Anyone can read the campaign tied to a published recap
CREATE POLICY "Public can read campaigns for published recaps"
  ON campaigns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      JOIN recaps ON recaps.session_id = sessions.id
      WHERE sessions.campaign_id = campaigns.id
      AND recaps.published_at IS NOT NULL
    )
  );

-- Anyone can insert recap_events (anonymous analytics)
CREATE POLICY "Public can insert recap events"
  ON recap_events FOR INSERT
  WITH CHECK (true);

-- Only service role can read recap_events
CREATE POLICY "Service role reads recap events"
  ON recap_events FOR SELECT
  USING (false);
