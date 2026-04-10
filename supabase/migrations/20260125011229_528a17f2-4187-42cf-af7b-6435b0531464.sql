-- Create trigger function that creates a notification when a reminder is inserted with a due date that has passed
CREATE OR REPLACE FUNCTION public.notify_on_reminder_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification if due date is today or past AND reminder time has passed (or no time set)
  IF NEW.due_date <= CURRENT_DATE AND 
     (NEW.reminder_time IS NULL OR 
      (NEW.due_date < CURRENT_DATE) OR 
      (NEW.due_date = CURRENT_DATE AND NEW.reminder_time <= CURRENT_TIME::text)) THEN
    
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      NEW.user_id,
      'Reminder: ' || NEW.title,
      COALESCE(NEW.description, 'Your reminder is due' || CASE WHEN NEW.ticker IS NOT NULL THEN ' for ' || NEW.ticker ELSE '' END),
      'reminder',
      jsonb_build_object(
        'reminderId', NEW.id,
        'ticker', NEW.ticker,
        'dueAt', (NEW.due_date::text || 'T' || COALESCE(NEW.reminder_time, '00:00:00'))::text
      )
    );
    
    -- Mark as notified to prevent edge function from creating a duplicate
    UPDATE public.reminders SET notified_at = NOW() WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS notify_on_reminder_insert_trigger ON public.reminders;
CREATE TRIGGER notify_on_reminder_insert_trigger
AFTER INSERT ON public.reminders
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_reminder_insert();