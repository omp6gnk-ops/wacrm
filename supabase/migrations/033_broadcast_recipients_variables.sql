-- Migration 033: Add variables column to broadcast_recipients
--
-- Enables recipient-specific variables (e.g. from copy-paste or CSV column uploads)
-- to be stored and used in background broadcast deliveries.

ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS variables JSONB;

COMMENT ON COLUMN broadcast_recipients.variables IS
  'Key-value pairs of raw recipient variables parsed from CSV or Copy-Paste uploads.';
