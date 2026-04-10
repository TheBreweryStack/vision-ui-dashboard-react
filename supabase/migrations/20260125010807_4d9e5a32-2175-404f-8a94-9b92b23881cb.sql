-- Add notifications and reminders tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE reminders;

-- Set REPLICA IDENTITY FULL for proper realtime sync
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE reminders REPLICA IDENTITY FULL;