-- Phase 4: Quotes table
-- Memorable table quotes captured by the GM during or after a session.

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  attribution TEXT,
  text TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS quotes_campaign_idx ON quotes (campaign_id);

-- RLS: same pattern as other tables — GM can read/write their own campaign's quotes.
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- For now, all authenticated users can read/write (no multi-user yet; RLS will tighten in Phase 7).
CREATE POLICY "quotes_all" ON quotes FOR ALL USING (true) WITH CHECK (true);
