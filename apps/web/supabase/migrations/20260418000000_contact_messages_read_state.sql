-- ============================================
-- Contact Messages: add is_read state + index for unread count
-- ============================================

ALTER TABLE contact_messages
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_contact_messages_unread
    ON contact_messages (is_read)
    WHERE is_read = FALSE;

-- Backfill: existing rows remain unread (default FALSE already applied).
