-- Add note_id column to reminders table for linking tasks to playbook entries
ALTER TABLE reminders ADD COLUMN note_id uuid REFERENCES notes(id) ON DELETE CASCADE;

-- Create index for efficient querying of tasks by note
CREATE INDEX idx_reminders_note_id ON reminders(note_id);