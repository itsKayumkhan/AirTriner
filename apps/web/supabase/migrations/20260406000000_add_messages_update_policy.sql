-- Fix: Messages were never marked as read because there was no UPDATE RLS policy.
-- Only SELECT and INSERT policies existed, causing read_at to stay NULL forever.
-- After logout/login, all messages appeared unread since the DB never persisted read state.
CREATE POLICY messages_update_all ON messages FOR UPDATE USING (true) WITH CHECK (true);
