-- ============================================
-- Atomic camp-spot decrement RPC + idempotency table
-- Fixes oversold race in stripe webhook (read-modify-write on
-- trainer_profiles.camp_offerings JSONB).
-- ============================================

-- 1) Idempotency table — keyed by booking id (stripe webhook may retry)
CREATE TABLE IF NOT EXISTS public.camp_spot_idempotency (
    booking_id UUID PRIMARY KEY,
    used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.camp_spot_idempotency ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role (bypasses RLS) can read/write.

-- 2) Atomic decrement RPC
CREATE OR REPLACE FUNCTION public.book_camp_spot(
    p_user_id UUID,
    p_camp_name TEXT,
    p_idempotency_key UUID
)
RETURNS TABLE(status TEXT, remaining INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_camps JSONB;
    v_idx INT;
    v_camp JSONB;
    v_remaining INT;
    v_max INT;
    v_new_camps JSONB;
    v_existing UUID;
    i INT;
BEGIN
    -- Idempotency: if this booking already consumed a spot, return current remaining
    IF p_idempotency_key IS NOT NULL THEN
        SELECT booking_id INTO v_existing
        FROM public.camp_spot_idempotency
        WHERE booking_id = p_idempotency_key;

        IF FOUND THEN
            -- Look up current remaining for visibility (best-effort; row not locked)
            SELECT camp_offerings INTO v_camps
            FROM public.trainer_profiles
            WHERE user_id = p_user_id;

            v_remaining := 0;
            IF v_camps IS NOT NULL AND jsonb_typeof(v_camps) = 'array' THEN
                FOR i IN 0 .. jsonb_array_length(v_camps) - 1 LOOP
                    IF v_camps -> i ->> 'name' = p_camp_name THEN
                        v_remaining := COALESCE((v_camps -> i ->> 'spotsRemaining')::INT, 0);
                        EXIT;
                    END IF;
                END LOOP;
            END IF;

            status := 'already_booked';
            remaining := v_remaining;
            RETURN NEXT;
            RETURN;
        END IF;
    END IF;

    -- Lock the trainer_profiles row to serialize concurrent decrements
    SELECT camp_offerings INTO v_camps
    FROM public.trainer_profiles
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        status := 'not_found';
        remaining := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    IF v_camps IS NULL OR jsonb_typeof(v_camps) <> 'array' THEN
        status := 'camp_not_found';
        remaining := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Find camp index by name
    v_idx := NULL;
    FOR i IN 0 .. jsonb_array_length(v_camps) - 1 LOOP
        IF v_camps -> i ->> 'name' = p_camp_name THEN
            v_idx := i;
            EXIT;
        END IF;
    END LOOP;

    IF v_idx IS NULL THEN
        status := 'camp_not_found';
        remaining := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    v_camp := v_camps -> v_idx;
    v_max := COALESCE((v_camp ->> 'maxSpots')::INT, 0);
    v_remaining := COALESCE((v_camp ->> 'spotsRemaining')::INT, v_max);

    IF v_remaining <= 0 THEN
        status := 'full';
        remaining := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    v_remaining := v_remaining - 1;

    -- Persist new spotsRemaining
    v_new_camps := jsonb_set(
        v_camps,
        ARRAY[v_idx::TEXT, 'spotsRemaining'],
        to_jsonb(v_remaining),
        true
    );

    UPDATE public.trainer_profiles
    SET camp_offerings = v_new_camps
    WHERE user_id = p_user_id;

    -- Record idempotency marker so retries are no-ops
    IF p_idempotency_key IS NOT NULL THEN
        INSERT INTO public.camp_spot_idempotency (booking_id)
        VALUES (p_idempotency_key)
        ON CONFLICT (booking_id) DO NOTHING;
    END IF;

    status := 'booked';
    remaining := v_remaining;
    RETURN NEXT;
    RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.book_camp_spot(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_camp_spot(UUID, TEXT, UUID) TO service_role;
