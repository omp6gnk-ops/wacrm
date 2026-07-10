-- Add position column to canned_responses to support ordered multiple messages per shortcut.
ALTER TABLE canned_responses
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;
