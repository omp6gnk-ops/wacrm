-- Migration 036: Add custom webhook payload template
--
-- Allows administrators to define a custom JSON payload template for Webhook integration
-- with variables like {{name}}, {{phone}}, {{remark}}, {{agent_name}}, {{exported_at}}.

ALTER TABLE integration_configs
  ADD COLUMN IF NOT EXISTS webhook_payload_template TEXT;

COMMENT ON COLUMN integration_configs.webhook_payload_template IS
  'Custom JSON payload template with placeholders for lead export.';
