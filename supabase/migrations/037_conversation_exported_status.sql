-- Migration 037: Add exported_to_sheet status to conversations
--
-- Tracks whether a conversation lead has already been exported to sheets/webhook.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS exported_to_sheet BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN conversations.exported_to_sheet IS
  'True if the lead data for this conversation has been exported to external integrations.';
