-- Fix: Messages page had no live updates because the `messages` table was
-- never added to the `supabase_realtime` publication. Without it,
-- `postgres_changes` subscriptions on `public.messages` never fire and the
-- other party only sees new messages after a full page reload — making the
-- chat feel completely broken for athletes <-> trainers.
--
-- This migration:
--   1. Ensures REPLICA IDENTITY FULL so UPDATE payloads include old+new rows
--      (needed for realtime UPDATE events used to refresh read_at state).
--   2. Adds the `messages` table to the realtime publication if missing.
--   3. Is idempotent — safe to re-run.

ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'messages'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
    END IF;
END
$$;

-- Safety: ensure RLS is enabled and the core policies exist.
-- Earlier we only shipped `messages_update_all` (20260406). If the client's DB
-- is missing the SELECT/INSERT policies (e.g. fresh env), messaging appears
-- broken — supabase.from('messages').select() returns empty + insert fails.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_select_all'
    ) THEN
        EXECUTE 'CREATE POLICY messages_select_all ON public.messages FOR SELECT USING (true)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_insert_all'
    ) THEN
        EXECUTE 'CREATE POLICY messages_insert_all ON public.messages FOR INSERT WITH CHECK (true)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_update_all'
    ) THEN
        EXECUTE 'CREATE POLICY messages_update_all ON public.messages FOR UPDATE USING (true) WITH CHECK (true)';
    END IF;
END
$$;
