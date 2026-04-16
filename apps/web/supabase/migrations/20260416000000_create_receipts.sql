-- Migration: Create receipts table
-- Stores email receipt records for booking payments (athlete + trainer)

CREATE TABLE IF NOT EXISTS receipts (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id      uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    recipient_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_role  text NOT NULL CHECK (recipient_role IN ('athlete', 'trainer')),
    recipient_email text NOT NULL,
    session_fee     numeric(10,2) NOT NULL,
    platform_fee    numeric(10,2) NOT NULL DEFAULT 0,
    total_amount    numeric(10,2) NOT NULL,
    trainer_payout  numeric(10,2) NOT NULL,
    sport           text NOT NULL,
    scheduled_at    timestamptz NOT NULL,
    email_sent      boolean DEFAULT false,
    created_at      timestamptz DEFAULT now()
);

-- Index for lookups by booking
CREATE INDEX IF NOT EXISTS idx_receipts_booking_id ON receipts(booking_id);

-- Index for user receipt history
CREATE INDEX IF NOT EXISTS idx_receipts_recipient_id ON receipts(recipient_id);

-- Row Level Security
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own receipts
CREATE POLICY "receipts_select_own"
    ON receipts FOR SELECT
    USING (recipient_id = auth.uid());

-- Policy: service role can insert (webhook uses service role key)
-- No insert policy for regular users — only the webhook inserts receipts
