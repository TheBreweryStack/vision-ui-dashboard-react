-- Add vapid_key_hash column to track which VAPID key was used for each subscription
ALTER TABLE push_subscriptions 
ADD COLUMN vapid_key_hash TEXT;