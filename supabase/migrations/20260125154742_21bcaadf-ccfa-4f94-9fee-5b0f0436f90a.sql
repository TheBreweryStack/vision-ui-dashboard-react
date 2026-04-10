-- Function to auto-create notification when reminder fires (notified_at is set)
CREATE OR REPLACE FUNCTION create_reminder_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when notified_at changes from NULL to a value
  IF OLD.notified_at IS NULL AND NEW.notified_at IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, data, is_read, created_at)
    VALUES (
      NEW.user_id,
      'reminder',
      'Reminder Due',
      NEW.title,
      jsonb_build_object(
        'reminderId', NEW.id::text,
        'noteId', NEW.note_id::text,
        'ticker', NEW.ticker,
        'priority', NEW.priority
      ),
      false,
      NOW()
    )
    ON CONFLICT ON CONSTRAINT notifications_unique_reminder DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't block the update
  RAISE WARNING 'Failed to create reminder notification: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to auto-delete notification when reminder is completed or deleted
CREATE OR REPLACE FUNCTION cleanup_reminder_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- When task is marked complete, delete its notification
    IF OLD.is_completed = FALSE AND NEW.is_completed = TRUE THEN
      DELETE FROM notifications 
      WHERE user_id = NEW.user_id 
        AND type = 'reminder'
        AND (data->>'reminderId') = NEW.id::text;
    END IF;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    -- When task is deleted, delete its notification
    DELETE FROM notifications 
    WHERE user_id = OLD.user_id 
      AND type = 'reminder'
      AND (data->>'reminderId') = OLD.id::text;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to cleanup reminder notification: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_create_reminder_notification ON reminders;
DROP TRIGGER IF EXISTS trigger_cleanup_reminder_notification ON reminders;

-- Create trigger for auto-creating notifications when reminder fires
CREATE TRIGGER trigger_create_reminder_notification
AFTER UPDATE ON reminders
FOR EACH ROW
EXECUTE FUNCTION create_reminder_notification();

-- Create trigger for auto-cleanup when reminder is completed or deleted
CREATE TRIGGER trigger_cleanup_reminder_notification
AFTER UPDATE OR DELETE ON reminders
FOR EACH ROW
EXECUTE FUNCTION cleanup_reminder_notification();