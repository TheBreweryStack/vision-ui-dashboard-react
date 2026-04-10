-- Add in-app notification control settings
ALTER TABLE notification_preferences 
ADD COLUMN IF NOT EXISTS show_toast_banners BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS mute_all_notifications BOOLEAN NOT NULL DEFAULT false;