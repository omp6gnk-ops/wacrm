-- Migration 039: Deduplicate conversations and add UNIQUE constraint
--
-- Merges duplicate conversations under the same (account_id, contact_id)
-- by re-keying children tables and deleting duplicate rows, then
-- enforces the unique constraint.

DO $$
DECLARE
  r RECORD;
  v_survivor UUID;
  v_losers UUID[];
BEGIN
  -- Find all duplicates
  FOR r IN 
    SELECT account_id, contact_id, COUNT(*) 
    FROM conversations 
    GROUP BY account_id, contact_id 
    HAVING COUNT(*) > 1
  LOOP
    -- Oldest conversation is the survivor
    SELECT id INTO v_survivor
    FROM conversations
    WHERE account_id = r.account_id AND contact_id = r.contact_id
    ORDER BY created_at ASC
    LIMIT 1;

    -- The rest are losers
    SELECT array_agg(id) INTO v_losers
    FROM conversations
    WHERE account_id = r.account_id AND contact_id = r.contact_id AND id <> v_survivor;

    IF v_losers IS NOT NULL AND array_length(v_losers, 1) > 0 THEN
      -- Rekey messages
      UPDATE messages
      SET conversation_id = v_survivor
      WHERE conversation_id = ANY(v_losers);

      -- Rekey message_reactions
      UPDATE message_reactions
      SET conversation_id = v_survivor
      WHERE conversation_id = ANY(v_losers);

      -- Rekey deals
      UPDATE deals
      SET conversation_id = v_survivor
      WHERE conversation_id = ANY(v_losers);

      -- Rekey flow_runs
      UPDATE flow_runs
      SET conversation_id = v_survivor
      WHERE conversation_id = ANY(v_losers);

      -- Rekey notifications
      UPDATE notifications
      SET conversation_id = v_survivor
      WHERE conversation_id = ANY(v_losers);

      -- Delete the duplicate conversations
      DELETE FROM conversations
      WHERE id = ANY(v_losers);
    END IF;
  END LOOP;
END $$;

-- Now add the unique constraint!
ALTER TABLE conversations
  ADD CONSTRAINT conversations_account_contact_unique UNIQUE (account_id, contact_id);
