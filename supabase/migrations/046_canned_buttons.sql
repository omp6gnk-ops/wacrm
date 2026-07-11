-- Add button_text and button_url to canned_responses and messages tables
ALTER TABLE canned_responses
  ADD COLUMN IF NOT EXISTS button_text TEXT,
  ADD COLUMN IF NOT EXISTS button_url TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS button_text TEXT,
  ADD COLUMN IF NOT EXISTS button_url TEXT;
