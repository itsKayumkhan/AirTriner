-- Add bio column to athlete_profiles
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS bio text;

NOTIFY pgrst, 'reload schema';
