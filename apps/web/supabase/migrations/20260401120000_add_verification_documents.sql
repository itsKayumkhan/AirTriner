-- Add verification_documents column to trainer_profiles
-- Stores an array of Supabase storage public URLs for uploaded PDFs
ALTER TABLE trainer_profiles
ADD COLUMN IF NOT EXISTS verification_documents text[] DEFAULT '{}';

-- Create the storage bucket for verification documents (run in Supabase dashboard if not exists)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('verification-documents', 'verification-documents', true)
-- ON CONFLICT (id) DO NOTHING;
