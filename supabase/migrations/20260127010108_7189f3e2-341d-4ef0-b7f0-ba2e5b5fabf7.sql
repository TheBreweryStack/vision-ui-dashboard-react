-- Add device_id column to track stable device identifier
ALTER TABLE push_subscriptions 
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Create index for efficient lookups by user_id + device_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_device 
ON push_subscriptions(user_id, device_id);