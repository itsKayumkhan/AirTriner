CREATE TABLE IF NOT EXISTS availability_recurring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_availability_recurring_trainer ON availability_recurring(trainer_id);

-- RLS
ALTER TABLE availability_recurring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers can manage their own recurring availability"
  ON availability_recurring FOR ALL
  USING (trainer_id IN (SELECT id FROM trainer_profiles WHERE user_id = auth.uid()))
  WITH CHECK (trainer_id IN (SELECT id FROM trainer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Anyone authenticated can read recurring availability"
  ON availability_recurring FOR SELECT
  USING (auth.role() = 'authenticated');
