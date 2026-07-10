-- Add trigger, sales, categorization, and payment columns to ai_configs.
-- Also create the ai_customer_assessments table.

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS coexist_with_automations BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS trigger_on_button_reply BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sales_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sales_system_prompt TEXT,
  ADD COLUMN IF NOT EXISTS collect_fields JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_categorize_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS categorize_after_replies INTEGER NOT NULL DEFAULT 3 CHECK (categorize_after_replies BETWEEN 1 AND 20),
  ADD COLUMN IF NOT EXISTS interested_tag_id UUID REFERENCES tags(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS not_interested_tag_id UUID REFERENCES tags(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS interested_status_id UUID REFERENCES conversation_custom_statuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS not_interested_status_id UUID REFERENCES conversation_custom_statuses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_qr_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- Drop check constraint on auto_reply_max_per_conversation if it exists and recreate with up to 50 max replies
ALTER TABLE ai_configs DROP CONSTRAINT IF EXISTS ai_configs_auto_reply_max_per_conversation_check;
ALTER TABLE ai_configs ADD CONSTRAINT ai_configs_auto_reply_max_per_conversation_check
  CHECK (auto_reply_max_per_conversation BETWEEN 1 AND 50);

-- Create table for AI customer assessments
CREATE TABLE IF NOT EXISTS ai_customer_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  interest_level TEXT NOT NULL CHECK (interest_level IN ('hot','warm','cold','not_interested')),
  collected_data JSONB DEFAULT '{}'::jsonb,
  ai_reasoning TEXT,
  actions_taken JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_customer_assessments ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and create
DROP POLICY IF EXISTS "Members can view assessments" ON ai_customer_assessments;
CREATE POLICY "Members can view assessments"
  ON ai_customer_assessments FOR SELECT
  USING (account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_assessments_conversation ON ai_customer_assessments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_account ON ai_customer_assessments(account_id);

-- Update the message reply trigger to reset AI reply count and re-enable auto-reply on human agent message
CREATE OR REPLACE FUNCTION update_conversation_reply_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_type = 'agent' THEN
    UPDATE conversations
    SET has_agent_replied = TRUE,
        ai_reply_count = 0,
        ai_autoreply_disabled = FALSE
    WHERE id = NEW.conversation_id;
  ELSIF NEW.sender_type = 'bot' THEN
    UPDATE conversations
    SET has_agent_replied = TRUE
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

