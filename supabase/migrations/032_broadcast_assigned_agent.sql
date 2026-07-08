-- Migration 032: Add assigned_agent_id to broadcasts
--
-- When a broadcast is created with an assigned agent, all inbound
-- replies to that broadcast automatically assign the conversation
-- to the specified agent. This enables campaign-based lead routing.

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN broadcasts.assigned_agent_id IS
  'Optional agent to auto-assign conversations when a broadcast recipient replies.';
