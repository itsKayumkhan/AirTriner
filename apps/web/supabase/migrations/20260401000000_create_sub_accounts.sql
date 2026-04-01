-- Migration: Create sub_accounts table
-- Supports family/sub-account feature: athletes can add up to 6 family members
-- who can book sessions billed to the parent account.

CREATE TABLE IF NOT EXISTS sub_accounts (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_data            jsonb NOT NULL DEFAULT '{}',
    max_bookings_per_month  int DEFAULT 10,
    is_active               boolean DEFAULT true,
    created_at              timestamptz DEFAULT now(),
    updated_at              timestamptz DEFAULT now()
);

-- Index for fast lookups by parent user
CREATE INDEX IF NOT EXISTS idx_sub_accounts_parent_user_id ON sub_accounts(parent_user_id);

-- Index for active sub-accounts
CREATE INDEX IF NOT EXISTS idx_sub_accounts_active ON sub_accounts(parent_user_id, is_active);

-- Row Level Security
ALTER TABLE sub_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own sub-accounts
CREATE POLICY "sub_accounts_select_own"
    ON sub_accounts FOR SELECT
    USING (parent_user_id = auth.uid());

-- Policy: users can insert sub-accounts for themselves only
CREATE POLICY "sub_accounts_insert_own"
    ON sub_accounts FOR INSERT
    WITH CHECK (parent_user_id = auth.uid());

-- Policy: users can update their own sub-accounts
CREATE POLICY "sub_accounts_update_own"
    ON sub_accounts FOR UPDATE
    USING (parent_user_id = auth.uid());

-- Policy: users can delete their own sub-accounts
CREATE POLICY "sub_accounts_delete_own"
    ON sub_accounts FOR DELETE
    USING (parent_user_id = auth.uid());

-- Trigger: auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sub_accounts_updated_at ON sub_accounts;
CREATE TRIGGER sub_accounts_updated_at
    BEFORE UPDATE ON sub_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
