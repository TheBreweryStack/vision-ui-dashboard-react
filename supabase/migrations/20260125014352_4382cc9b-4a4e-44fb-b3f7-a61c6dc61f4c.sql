-- Add unified due_at timestamp column for reliable scheduling
ALTER TABLE public.reminders
ADD COLUMN IF NOT EXISTS due_at timestamp with time zone;

-- Migrate existing data: combine due_date + reminder_time into due_at
UPDATE public.reminders
SET due_at = CASE
  WHEN reminder_time IS NOT NULL THEN reminder_time
  WHEN due_date IS NOT NULL THEN (due_date::date + TIME '23:59:00')::timestamptz
  ELSE NULL
END
WHERE due_at IS NULL;