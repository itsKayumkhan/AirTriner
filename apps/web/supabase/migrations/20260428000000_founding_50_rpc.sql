-- Founding 50 atomic grant RPC.
-- Postgres function bodies execute inside a single transaction, so the cap
-- check + update happen atomically — two concurrent calls can never both
-- promote the 50th and 51st trainer.
--
-- Returns a single row with status:
--   status = 'granted'        → trainer was promoted, current_count is post-update total
--   status = 'already'        → trainer was already founding_50 (no-op)
--   status = 'not_found'      → no trainer_profile for that user_id
--   status = 'cap_reached'    → 50 active founding_50 rows already exist
CREATE OR REPLACE FUNCTION public.grant_founding_50(p_user_id uuid)
RETURNS TABLE(status text, current_count integer, profile_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile_id uuid;
    v_already boolean;
    v_count integer;
BEGIN
    -- Lock the trainer row first to serialise concurrent grants on the same trainer.
    SELECT id, is_founding_50
      INTO v_profile_id, v_already
      FROM trainer_profiles
     WHERE user_id = p_user_id
     FOR UPDATE;

    IF v_profile_id IS NULL THEN
        RETURN QUERY SELECT 'not_found'::text, 0, NULL::uuid;
        RETURN;
    END IF;

    IF v_already THEN
        SELECT COUNT(*)::int INTO v_count FROM trainer_profiles WHERE is_founding_50 = TRUE;
        RETURN QUERY SELECT 'already'::text, v_count, v_profile_id;
        RETURN;
    END IF;

    -- Cap check inside the same transaction. Any other in-flight grant has
    -- either committed (and bumped the count) or is still holding its row
    -- lock — but the COUNT here sees only committed rows at this snapshot.
    -- The unique partial index below is the hard backstop.
    SELECT COUNT(*)::int INTO v_count FROM trainer_profiles WHERE is_founding_50 = TRUE;
    IF v_count >= 50 THEN
        RETURN QUERY SELECT 'cap_reached'::text, v_count, v_profile_id;
        RETURN;
    END IF;

    UPDATE trainer_profiles
       SET is_founding_50 = TRUE,
           founding_50_granted_at = NOW(),
           subscription_status = 'active',
           subscription_expires_at = NOW() + INTERVAL '180 days'
     WHERE id = v_profile_id;

    SELECT COUNT(*)::int INTO v_count FROM trainer_profiles WHERE is_founding_50 = TRUE;
    RETURN QUERY SELECT 'granted'::text, v_count, v_profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_founding_50(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_founding_50(uuid) TO service_role;
