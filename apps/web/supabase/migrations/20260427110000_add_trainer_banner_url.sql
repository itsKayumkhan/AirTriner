-- Add banner_url to trainer_profiles for custom public-profile cover images.
-- When NULL, the public profile falls back to a sport-based default banner.
ALTER TABLE trainer_profiles
    ADD COLUMN IF NOT EXISTS banner_url TEXT;
