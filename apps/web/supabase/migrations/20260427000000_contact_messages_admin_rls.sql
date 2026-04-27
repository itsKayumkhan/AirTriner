-- ============================================
-- contact_messages: add RLS policies so admins can read/update/delete
-- Bug: RLS was enabled with zero policies → admin inbox always returned 0 rows
-- even though /api/contact (service role) kept inserting successfully.
-- ============================================

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage contact_messages" ON contact_messages;
CREATE POLICY "Admins manage contact_messages"
    ON contact_messages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
              AND users.role = 'admin'::user_role
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
              AND users.role = 'admin'::user_role
        )
    );
