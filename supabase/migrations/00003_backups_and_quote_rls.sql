-- Phase 51: cloud backup snapshots + tighten quotes RLS.

-- ---------------------------------------------------------------------------
-- Cloud backups: one row per snapshot, owned by the authenticated user.
-- Payload is the complete campaign export JSON (format grimoire-export v2),
-- which since the campaignData manifest covers relational + GM-tool data.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  size_bytes INTEGER NOT NULL,
  app_version TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS backups_user_idx ON backups(user_id, created_at DESC);

ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Owners only, for everything. No public access of any kind.
CREATE POLICY "backups_owner_select" ON backups FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "backups_owner_insert" ON backups FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "backups_owner_delete" ON backups FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Tighten quotes RLS. The Phase 4 placeholder policy was FOR ALL USING (true)
-- — anyone holding the public anon key could write or delete any quote.
-- Writes now go exclusively through the service-role publish endpoint (which
-- bypasses RLS); the public keeps read access only for quotes attached to a
-- session whose recap is published, which is exactly what /r/[slug] renders.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "quotes_all" ON quotes;

CREATE POLICY "quotes_public_read_published" ON quotes FOR SELECT
  USING (
    session_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM recaps r
      WHERE r.session_id = quotes.session_id
        AND r.published_at IS NOT NULL
    )
  );
