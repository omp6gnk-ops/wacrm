ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMPTZ;
-- Backfill from existing messages
UPDATE conversations c SET last_customer_message_at = (
  SELECT MAX(created_at) FROM messages m 
  WHERE m.conversation_id = c.id AND m.sender_type = 'customer'
);
