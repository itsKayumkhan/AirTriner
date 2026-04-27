-- ============================================
-- Fix: "Admins manage users" recursed (policy on users SELECT'ed users).
-- Replace with a SECURITY DEFINER helper function that bypasses RLS for
-- the role lookup, then rebuild every "Admins manage X" policy to call it.
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = uid
          AND role = 'admin'::user_role
          AND is_suspended = FALSE
          AND deleted_at IS NULL
    );
$$;

-- The function runs as the table owner so it sees the row regardless of RLS.
REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, anon, service_role;

-- ───────────────────────────────────────────────
-- Rebuild policies to use is_admin(auth.uid())
-- ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage users" ON public.users;
CREATE POLICY "Admins manage users"
    ON public.users FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage trainer_profiles" ON public.trainer_profiles;
CREATE POLICY "Admins manage trainer_profiles"
    ON public.trainer_profiles FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage athlete_profiles" ON public.athlete_profiles;
CREATE POLICY "Admins manage athlete_profiles"
    ON public.athlete_profiles FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage bookings" ON public.bookings;
CREATE POLICY "Admins manage bookings"
    ON public.bookings FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage disputes" ON public.disputes;
CREATE POLICY "Admins manage disputes"
    ON public.disputes FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage payment_transactions" ON public.payment_transactions;
CREATE POLICY "Admins manage payment_transactions"
    ON public.payment_transactions FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage sports" ON public.sports;
CREATE POLICY "Admins manage sports"
    ON public.sports FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
CREATE POLICY "Admins manage notifications"
    ON public.notifications FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage contact_messages" ON public.contact_messages;
CREATE POLICY "Admins manage contact_messages"
    ON public.contact_messages FOR ALL TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read messages" ON public.messages;
CREATE POLICY "Admins read messages"
    ON public.messages FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins read audit log"
    ON public.admin_audit_log FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));
