-- Add configurable reply limit reset cooldown (in minutes) to ai_configs.
-- When a conversation is inactive for this many minutes, the AI reply count resets to 0.
-- Default is 240 minutes (4 hours).

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS ai_reply_limit_reset_minutes INTEGER NOT NULL DEFAULT 240
    CHECK (ai_reply_limit_reset_minutes >= 1);
