-- ============================================
-- Per-duration pricing for trainers (replaces single hourly_rate prorate model)
--
-- New column: session_pricing JSONB
--   {
--     "30": { "price": 25.00, "enabled": true },
--     "45": { "price": 37.50, "enabled": true },
--     "60": { "price": 50.00, "enabled": true }
--   }
--
-- Backfill: every trainer gets entries for all 3 durations.
--   - "60" always uses hourly_rate as the price.
--   - "30" / "45" prices = proportional to hourly_rate.
--   - "enabled" flag is true ONLY if the duration was already in session_lengths.
--     Trainers who only had [60] keep just 60 enabled — no behaviour change.
--
-- hourly_rate column is preserved for backward compat (search/sort filters
-- still reference it; we keep it in sync with the 60-min slot price).
-- ============================================

ALTER TABLE trainer_profiles
    ADD COLUMN IF NOT EXISTS session_pricing JSONB;

UPDATE trainer_profiles
SET session_pricing = jsonb_build_object(
    '30', jsonb_build_object(
        'price', ROUND((COALESCE(hourly_rate, 50) * 0.5)::numeric, 2),
        'enabled', COALESCE(session_lengths @> ARRAY[30], FALSE)
    ),
    '45', jsonb_build_object(
        'price', ROUND((COALESCE(hourly_rate, 50) * 0.75)::numeric, 2),
        'enabled', COALESCE(session_lengths @> ARRAY[45], FALSE)
    ),
    '60', jsonb_build_object(
        'price', ROUND(COALESCE(hourly_rate, 50)::numeric, 2),
        'enabled', COALESCE(session_lengths @> ARRAY[60], TRUE)
    )
)
WHERE session_pricing IS NULL;

-- Safety: every trainer should have at least one enabled duration.
-- If a trainer somehow had session_lengths with none of 30/45/60 (e.g. only camp lengths),
-- enable 60 with hourly_rate so they remain bookable.
UPDATE trainer_profiles
SET session_pricing = jsonb_set(
    session_pricing,
    '{60,enabled}',
    'true'::jsonb
)
WHERE NOT (
    (session_pricing->'30'->>'enabled')::boolean
    OR (session_pricing->'45'->>'enabled')::boolean
    OR (session_pricing->'60'->>'enabled')::boolean
);

CREATE INDEX IF NOT EXISTS idx_trainer_profiles_session_pricing
    ON trainer_profiles USING GIN (session_pricing);
