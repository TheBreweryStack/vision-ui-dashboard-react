import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge function that processes due reminders and sends push notifications.
 * 
 * This function runs on a cron schedule to:
 * 1. Find reminders that are due but not yet notified
 * 2. Insert notifications into the notifications table (for history/badge)
 * 3. Send actual push notifications to all user devices
 * 4. Mark reminders as notified (to prevent duplicate processing)
 * 5. Clean up stale push subscriptions (410 Gone errors)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    console.log(`[check-due-reminders] Checking reminders at ${now.toISOString()}`);

    // Load VAPID keys for push notifications
    const vapidKeysJwk = Deno.env.get('VAPID_KEYS_JWK');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@tradercafe.app';
    
    let appServer: webpush.ApplicationServer | null = null;
    
    if (vapidKeysJwk) {
      try {
        const parsedKeys = JSON.parse(vapidKeysJwk);
        const vapidKeys = await webpush.importVapidKeys(parsedKeys, { extractable: true });
        appServer = await webpush.ApplicationServer.new({
          contactInformation: vapidSubject,
          vapidKeys,
        });
        console.log('[check-due-reminders] Web push initialized');
      } catch (e) {
        console.warn('[check-due-reminders] Failed to initialize web push:', e);
      }
    } else {
      console.warn('[check-due-reminders] VAPID_KEYS_JWK not configured, skipping push notifications');
    }

    // Find due reminders - check both due_at and legacy reminder_time columns
    const { data: dueReminders, error: fetchError } = await supabase
      .from('reminders')
      .select('*')
      .eq('is_completed', false)
      .is('notified_at', null)
      .or(`due_at.lte.${now.toISOString()},and(due_at.is.null,reminder_time.lte.${now.toISOString()})`);

    if (fetchError) throw fetchError;

    console.log(`[check-due-reminders] Found ${dueReminders?.length || 0} due reminders`);

    const stats = { 
      processed: 0, 
      notified: 0, 
      pushSent: 0, 
      pushFailed: 0,
      staleDeleted: 0 
    };

    for (const reminder of dueReminders || []) {
      try {
        // Check user preferences
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('reminder_alerts, mute_all_notifications')
          .eq('user_id', reminder.user_id)
          .maybeSingle();

        const shouldNotify = prefs?.reminder_alerts !== false &&
                            prefs?.mute_all_notifications !== true;

        // Insert a notification record for history/badge (if user wants notifications)
        if (shouldNotify) {
          await supabase
            .from('notifications')
            .insert({
              user_id: reminder.user_id,
              title: 'Reminder Due',
              body: reminder.title,
              type: 'reminder',
              data: {
                reminderId: reminder.id,
                noteId: reminder.note_id,
                url: reminder.note_id 
                  ? `/playbook?note=${reminder.note_id}` 
                  : '/playbook',
              }
            });
          stats.notified++;

          // Send push notifications to all user devices
          if (appServer) {
            const pushResult = await sendPushToUser(
              supabase,
              appServer,
              reminder.user_id,
              {
                title: '⏰ Reminder Due',
                body: reminder.title,
                icon: '/app-icon.png',
                badge: '/app-icon.png',
                tag: `reminder-${reminder.id}`,
                data: {
                  url: reminder.note_id 
                    ? `/playbook?note=${reminder.note_id}` 
                    : '/playbook',
                  type: 'reminder',
                  reminderId: reminder.id,
                }
              }
            );
            stats.pushSent += pushResult.sent;
            stats.pushFailed += pushResult.failed;
            stats.staleDeleted += pushResult.staleDeleted;
          }
        }

        // Mark as notified (whether we notified or not, to prevent reprocessing)
        const { error: updateError } = await supabase
          .from('reminders')
          .update({ notified_at: now.toISOString() })
          .eq('id', reminder.id);

        if (updateError) {
          console.error(`[check-due-reminders] Failed to update reminder ${reminder.id}:`, updateError);
        } else {
          stats.processed++;
          console.log(`[check-due-reminders] Processed reminder ${reminder.id}: ${reminder.title}`);
        }
      } catch (error) {
        console.error(`[check-due-reminders] Error processing reminder ${reminder.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[check-due-reminders] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface PushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send push notification to all devices registered for a user
 */
async function sendPushToUser(
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  appServer: webpush.ApplicationServer,
  userId: string,
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
  }
): Promise<{ sent: number; failed: number; staleDeleted: number }> {
  const result = { sent: 0, failed: 0, staleDeleted: 0 };

  // Get all push subscriptions for this user
  const { data, error } = await supabaseClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error || !data?.length) {
    console.log(`[sendPushToUser] No subscriptions for user ${userId}`);
    return result;
  }

  // Cast to known type
  const subscriptions = data as unknown as PushSubscription[];

  const payload = JSON.stringify({
    ...notification,
    silent: false,
    requireInteraction: true,
  });

  for (const sub of subscriptions) {
    try {
      const subscriber = appServer.subscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      });

      await subscriber.pushTextMessage(payload, {});
      result.sent++;

      // Update last successful push timestamp
      await supabaseClient
        .from('push_subscriptions')
        .update({ last_successful_push_at: new Date().toISOString() })
        .eq('id', sub.id);

    } catch (pushError: unknown) {
      result.failed++;

      const response = (pushError as { response?: Response })?.response;
      const statusCode = response?.status;

      console.error(`[sendPushToUser] Push failed for sub ${sub.id}: status=${statusCode}`);

      // Handle stale subscriptions (410 Gone)
      if (statusCode === 410) {
        console.log(`[sendPushToUser] Deleting stale subscription ${sub.id}`);
        await supabaseClient.from('push_subscriptions').delete().eq('id', sub.id);
        result.staleDeleted++;
      }
    }
  }

  return result;
}
