-- Migration: Add Stripe processing fee + tax columns to bookings, payment_transactions, receipts
-- Fee model overhaul: athlete now pays (price + platform_fee + stripe_fee + tax).
-- Trainer always receives 100% of price. Tax applies when trainer country = CA (HST 13%).

-- ── bookings ──
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS stripe_fee   numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount   numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_label    text;

-- ── payment_transactions ──
ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS stripe_fee   numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount   numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_label    text;

-- ── receipts ──
ALTER TABLE receipts
    ADD COLUMN IF NOT EXISTS stripe_fee   numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount   numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_label    text;

COMMENT ON COLUMN bookings.stripe_fee IS 'Stripe 2.9% + $0.30 processing fee paid by athlete.';
COMMENT ON COLUMN bookings.tax_amount IS 'Sales tax collected (e.g. Canadian HST 13%). 0 when not applicable.';
COMMENT ON COLUMN bookings.tax_label  IS 'Display label for tax, e.g. "HST (13%)".';
