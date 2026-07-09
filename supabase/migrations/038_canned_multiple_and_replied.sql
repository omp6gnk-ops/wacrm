-- Migration 038: Support multiple canned responses with the same shortcut
-- and track if agent/bot has ever replied to a conversation.

-- 1. Canned responses: drop unique shortcut constraint to allow multiple items per shortcut
ALTER TABLE canned_responses DROP CONSTRAINT IF EXISTS canned_responses_account_id_shortcut_key;

-- 2. Conversations: track if agent/bot has ever replied
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS has_agent_replied BOOLEAN DEFAULT FALSE;

-- Backfill existing conversations
UPDATE conversations c
SET has_agent_replied = TRUE
WHERE EXISTS (
  SELECT 1 FROM messages m
  WHERE m.conversation_id = c.id AND m.sender_type IN ('agent', 'bot')
);

-- Automatically set has_agent_replied on new message insertion
CREATE OR REPLACE FUNCTION update_conversation_reply_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_type IN ('agent', 'bot') THEN
    UPDATE conversations
    SET has_agent_replied = TRUE
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_conversation_reply_status ON messages;

CREATE TRIGGER trigger_update_conversation_reply_status
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_reply_status();
