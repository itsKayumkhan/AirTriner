-- One-shot data migration: convert single-sport string to sports array in sub_accounts.profile_data
-- Backwards compatible: code reads `sports` array but falls back to [sport] if missing
UPDATE sub_accounts
SET profile_data = jsonb_set(profile_data, '{sports}', to_jsonb(ARRAY[profile_data->>'sport']))
WHERE profile_data ? 'sport' AND NOT profile_data ? 'sports';
