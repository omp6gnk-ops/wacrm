-- Migration 034: Add media fields to canned responses
ALTER TABLE canned_responses
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video', 'document', 'audio'));

COMMENT ON COLUMN canned_responses.media_url IS 'Optional URL of media attachment to send along with the canned response.';
COMMENT ON COLUMN canned_responses.media_type IS 'Optional type of media (image, video, document, audio).';
