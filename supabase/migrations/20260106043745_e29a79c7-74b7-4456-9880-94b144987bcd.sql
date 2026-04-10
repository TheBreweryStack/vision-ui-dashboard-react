-- Add notified_at to reminders for tracking sent notifications
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS notified_at timestamptz;

-- Add inbox_alerts preference to notification_preferences
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS inbox_alerts boolean DEFAULT true;

-- Create notifications history table for in-app notification center
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,  -- 'reminder', 'price_alert', 'trade_inbox', 'announcement'
  title text NOT NULL,
  body text,
  data jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own notifications
CREATE POLICY "Users can view their own notifications" 
ON notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" 
ON notifications 
FOR DELETE 
USING (auth.uid() = user_id);

-- Service role can insert notifications (from edge functions)
CREATE POLICY "Service role can insert notifications" 
ON notifications 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);