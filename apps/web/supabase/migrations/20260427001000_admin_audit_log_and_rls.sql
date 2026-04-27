-- ============================================
-- 1) admin_audit_log: persistent record of admin actions
-- 2) Admin RLS policies for tables admins must read/write from the browser
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_type, target_id);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log" ON admin_audit_log;
CREATE POLICY "Admins read audit log"
    ON admin_audit_log FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));

-- helper macro pattern: admin USING/CHECK
-- Apply admin "FOR ALL" policies to tables read/written by admin browser pages.

-- users: admin can read all + update suspension/role/etc
DROP POLICY IF EXISTS "Admins manage users" ON users;
CREATE POLICY "Admins manage users"
    ON users FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'::user_role))
    WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'::user_role));

-- trainer_profiles
DROP POLICY IF EXISTS "Admins manage trainer_profiles" ON trainer_profiles;
CREATE POLICY "Admins manage trainer_profiles"
    ON trainer_profiles FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));

-- athlete_profiles
DROP POLICY IF EXISTS "Admins manage athlete_profiles" ON athlete_profiles;
CREATE POLICY "Admins manage athlete_profiles"
    ON athlete_profiles FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));

-- bookings
DROP POLICY IF EXISTS "Admins manage bookings" ON bookings;
CREATE POLICY "Admins manage bookings"
    ON bookings FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));

-- disputes
DROP POLICY IF EXISTS "Admins manage disputes" ON disputes;
CREATE POLICY "Admins manage disputes"
    ON disputes FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));

-- payment_transactions
DROP POLICY IF EXISTS "Admins manage payment_transactions" ON payment_transactions;
CREATE POLICY "Admins manage payment_transactions"
    ON payment_transactions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));

-- sports
DROP POLICY IF EXISTS "Admins manage sports" ON sports;
CREATE POLICY "Admins manage sports"
    ON sports FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));

-- notifications: admin can insert (used to alert admins / cross-user notifs)
DROP POLICY IF EXISTS "Admins manage notifications" ON notifications;
CREATE POLICY "Admins manage notifications"
    ON notifications FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));

-- messages (in-app trainer<->athlete DMs): admin read-only oversight
DROP POLICY IF EXISTS "Admins read messages" ON messages;
CREATE POLICY "Admins read messages"
    ON messages FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));
