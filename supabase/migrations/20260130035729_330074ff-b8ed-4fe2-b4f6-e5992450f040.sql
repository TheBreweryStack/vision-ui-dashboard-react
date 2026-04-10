-- Add device_metadata column to push_subscriptions
ALTER TABLE push_subscriptions 
ADD COLUMN IF NOT EXISTS device_metadata JSONB;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_metadata 
ON push_subscriptions USING GIN (device_metadata);

-- Add comment to explain the column
COMMENT ON COLUMN push_subscriptions.device_metadata IS 'Device metadata captured during subscription: {os, osVersion, browser, browserVersion, deviceType, timezone, screenWidth, screenHeight}';