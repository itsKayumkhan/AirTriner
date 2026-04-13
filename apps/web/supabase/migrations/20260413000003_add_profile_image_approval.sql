-- Add profile image columns to trainer_profiles for admin-approved profile photos
-- Stores the image URL, approval status, and rejection reason
ALTER TABLE trainer_profiles
  ADD COLUMN IF NOT EXISTS profile_image_url text,
  ADD COLUMN IF NOT EXISTS profile_image_status text DEFAULT 'none' CHECK (profile_image_status IN ('none','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS profile_image_rejection_reason text;

-- Create the storage bucket for trainer profile images (run in Supabase dashboard if not exists)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('trainer-profile-images', 'trainer-profile-images', true)
-- ON CONFLICT (id) DO NOTHING;
