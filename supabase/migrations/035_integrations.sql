-- Migration 035: Lead Export Integrations (Webhook and Google Sheets)
--
-- Adds config fields for sending contact/lead details to Google Sheets
-- or third-party webhooks from the inbox chat header.

CREATE TABLE IF NOT EXISTS integration_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,
  webhook_url         TEXT,
  sheet_spreadsheet_id TEXT,
  sheet_name          TEXT DEFAULT 'Sheet1',
  sheet_client_email  TEXT,
  sheet_private_key   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY integrations_select ON integration_configs
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY integrations_all ON integration_configs
  FOR ALL USING (is_account_member(account_id, 'admin'));

-- Trigger to auto-create integration_config when an account is created
CREATE OR REPLACE FUNCTION public.handle_new_integration_config()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.integration_configs (account_id)
  VALUES (new.id)
  ON CONFLICT (account_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_account_created_integrations
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_integration_config();

-- Backfill existing accounts
INSERT INTO public.integration_configs (account_id)
SELECT id FROM public.accounts
ON CONFLICT (account_id) DO NOTHING;
