-- Add Razorpay settings and assigned agents filter to ai_configs
ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS restrict_to_agent_ids JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS razorpay_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS razorpay_key_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_key_secret TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_webhook_secret TEXT;

-- Create table for Agent-Specific AI Assistants
CREATE TABLE IF NOT EXISTS ai_agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  system_prompt TEXT NOT NULL,
  max_replies INTEGER NOT NULL DEFAULT 3 CHECK (max_replies BETWEEN 1 AND 10),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, agent_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE ai_agent_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DROP POLICY IF EXISTS ai_agent_configs_select ON ai_agent_configs;
CREATE POLICY ai_agent_configs_select ON ai_agent_configs FOR SELECT
  USING (account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ai_agent_configs_insert ON ai_agent_configs;
CREATE POLICY ai_agent_configs_insert ON ai_agent_configs FOR INSERT
  WITH CHECK (account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ai_agent_configs_update ON ai_agent_configs;
CREATE POLICY ai_agent_configs_update ON ai_agent_configs FOR UPDATE
  USING (account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS ai_agent_configs_delete ON ai_agent_configs;
CREATE POLICY ai_agent_configs_delete ON ai_agent_configs FOR DELETE
  USING (account_id IN (SELECT account_id FROM profiles WHERE user_id = auth.uid()));

-- Create Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_ai_agent_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_agent_configs_updated_at ON ai_agent_configs;
CREATE TRIGGER ai_agent_configs_updated_at
  BEFORE UPDATE ON ai_agent_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_agent_configs_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_agent_configs_agent ON ai_agent_configs(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_configs_account ON ai_agent_configs(account_id);
