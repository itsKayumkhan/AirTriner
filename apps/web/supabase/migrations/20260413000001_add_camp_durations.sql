-- Add camp_offerings column to trainer_profiles
-- Stores a JSON array of multi-day camp offerings
-- Each entry: { name, hoursPerDay, days, totalPrice }
ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS camp_offerings jsonb DEFAULT '[]'::jsonb;
