-- Backfill: normalize sports[] arrays in trainer_profiles and athlete_profiles
-- Convert to canonical lowercase slug form so search filters and sort
-- comparisons are case-consistent. Matches lib/format.ts normalizeSports().
--   "Track & Field" -> "track_and_field"
--   "Martial Arts"  -> "martial_arts"

UPDATE trainer_profiles
SET sports = COALESCE(
  (SELECT array_agg(DISTINCT lower(replace(replace(elem, ' & ', '_and_'), ' ', '_')))
     FROM unnest(sports) AS elem),
  '{}'::text[]
)
WHERE sports IS NOT NULL AND array_length(sports, 1) > 0;

UPDATE athlete_profiles
SET sports = COALESCE(
  (SELECT array_agg(DISTINCT lower(replace(replace(elem, ' & ', '_and_'), ' ', '_')))
     FROM unnest(sports) AS elem),
  '{}'::text[]
)
WHERE sports IS NOT NULL AND array_length(sports, 1) > 0;
