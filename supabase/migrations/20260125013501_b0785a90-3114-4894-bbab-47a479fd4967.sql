-- Step 1: Drop the INSERT trigger that fires immediately on task creation
DROP TRIGGER IF EXISTS notify_on_reminder_insert_trigger ON public.reminders;

-- Step 2: Drop the trigger function (no longer needed)
DROP FUNCTION IF EXISTS public.notify_on_reminder_insert();

-- Step 3: Add unique constraint to prevent duplicate reminder notifications
CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_reminder
ON public.notifications (user_id, type, (data->>'reminderId'))
WHERE type = 'reminder' AND data->>'reminderId' IS NOT NULL;

-- Step 4: Clean up any existing duplicate notifications
DELETE FROM notifications n1
USING notifications n2
WHERE n1.ctid < n2.ctid
  AND n1.user_id = n2.user_id
  AND n1.type = 'reminder'
  AND n1.data->>'reminderId' = n2.data->>'reminderId';