-- Add configurable AI takeover delay (in minutes) to ai_configs.
-- When a chat is assigned to an agent but the agent hasn't replied
-- within this many minutes, AI auto-reply kicks in.
-- Default 5 minutes. Range 0–60.
-- 0 = instant AI takeover (AI replies immediately even on assigned chats).

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS ai_takeover_minutes INTEGER NOT NULL DEFAULT 5
    CHECK (ai_takeover_minutes BETWEEN 0 AND 60);
