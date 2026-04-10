-- Add dismissed_at column to reminders table for notification center dismissal
ALTER TABLE reminders ADD COLUMN dismissed_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for efficient filtering
CREATE INDEX idx_reminders_dismissed_at ON reminders(dismissed_at) WHERE dismissed_at IS NULL;