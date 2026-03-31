-- Add session_lengths and training_locations to trainer_profiles
ALTER TABLE trainer_profiles
  ADD COLUMN IF NOT EXISTS session_lengths integer[] DEFAULT '{60}',
  ADD COLUMN IF NOT EXISTS training_locations text[] DEFAULT '{}';

-- Update existing trainers to have default session length of 60 min
UPDATE trainer_profiles
SET session_lengths = '{60}'
WHERE session_lengths IS NULL OR array_length(session_lengths, 1) IS NULL;
