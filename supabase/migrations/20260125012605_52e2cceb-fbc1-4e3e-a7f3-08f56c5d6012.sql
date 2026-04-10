-- Make the notify_on_reminder_insert trigger NON-BLOCKING
-- If notification insert fails, task creation still succeeds

CREATE OR REPLACE FUNCTION public.notify_on_reminder_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only attempt notification if due date is today or past
  IF NEW.due_date IS NOT NULL AND NEW.due_date <= CURRENT_DATE THEN
    BEGIN
      -- Check if reminder time has passed (or no time set, or past date)
      IF NEW.reminder_time IS NULL OR 
         NEW.due_date < CURRENT_DATE OR 
         (NEW.due_date = CURRENT_DATE AND NEW.reminder_time::time <= CURRENT_TIME) THEN
        
        INSERT INTO public.notifications (user_id, title, body, type, data)
        VALUES (
          NEW.user_id,
          'Reminder: ' || COALESCE(NEW.title, 'Task'),
          COALESCE(NEW.description, 'Your reminder is due' || CASE WHEN NEW.ticker IS NOT NULL THEN ' for ' || NEW.ticker ELSE '' END),
          'reminder',
          jsonb_build_object(
            'reminderId', NEW.id,
            'ticker', NEW.ticker,
            'dueAt', (NEW.due_date::text || 'T' || COALESCE(NEW.reminder_time::text, '00:00:00'))
          )
        );
        
        -- Mark as notified to prevent edge function from creating a duplicate
        UPDATE public.reminders SET notified_at = NOW() WHERE id = NEW.id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- NON-BLOCKING: Log warning but do NOT fail the task insert
      RAISE WARNING 'notify_on_reminder_insert failed for reminder %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;