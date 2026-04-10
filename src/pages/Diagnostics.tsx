import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Bell, BellOff, Send, Database, Zap, Clock, Smartphone, AlertTriangle } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { getPushSubscription, forceServiceWorkerControl, EXPECTED_SW_VERSION, SW_FILENAME } from '@/lib/pushNotifications';
import { toast } from 'sonner';

// Build ID is set at compile time
const BUILD_ID = new Date().toISOString();

const Diagnostics: React.FC = () => {
  const { user, session, profile, userRole, isAdmin, isLoading } = useAuth();
  const [testResults, setTestResults] = useState<Record<string, { status: 'idle' | 'loading' | 'success' | 'error'; message: string }>>({
    'stripe-sales': { status: 'idle', message: '' },
    'contact-support': { status: 'idle', message: '' },
    'check-due-reminders': { status: 'idle', message: '' },
  });
  
  const [testPushStatus, setTestPushStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testReminderStatus, setTestReminderStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testReminderInfo, setTestReminderInfo] = useState<{ id: string; firesAt: string } | null>(null);
  const [isResubscribing, setIsResubscribing] = useState(false);
  const [isFixingControl, setIsFixingControl] = useState(false);
  const [swLogs, setSwLogs] = useState<string[]>([]);
  const [swTestResult, setSwTestResult] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');

  // Push notification state
  const { 
    isSupported: pushSupported, 
    isSubscribed: pushSubscribed, 
    isLoading: pushLoading, 
    permission: pushPermission,
    refresh: refreshPush,
    subscribe: subscribePush
  } = usePushNotifications();

  const [isCurrentDeviceRegistered, setIsCurrentDeviceRegistered] = useState<boolean | null>(null);

  const [subscriptionDetails, setSubscriptionDetails] = useState<{
    endpoint: string;
    expirationTime: number | null;
    keys?: { p256dh?: string; auth?: string };
  } | null>(null);

  const [dbSubscriptions, setDbSubscriptions] = useState<Array<{
    id: string;
    endpoint: string;
    created_at: string;
  }>>([]);
  
  const [testingDeviceEndpoint, setTestingDeviceEndpoint] = useState<string | null>(null);

  // Helper function to identify device type from endpoint
  const getDeviceType = (endpoint: string): { label: string; emoji: string } => {
    if (endpoint.includes('web.push.apple.com')) return { label: 'Safari', emoji: '🍎' };
    if (endpoint.includes('fcm.googleapis.com')) return { label: 'Chrome/FCM', emoji: '📱' };
    if (endpoint.includes('mozilla.com') || endpoint.includes('mozilla.org')) return { label: 'Firefox', emoji: '🦊' };
    if (endpoint.includes('windows.com') || endpoint.includes('microsoft.com')) return { label: 'Edge', emoji: '🪟' };
    return { label: 'Unknown', emoji: '🌐' };
  };

  const [swStatus, setSwStatus] = useState<{
    registered: boolean;
    active: boolean;
    waiting: boolean;
    controller: boolean;
    scriptURL: string | null;
  }>({ registered: false, active: false, waiting: false, controller: false, scriptURL: null });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Fetch browser push subscription details
  const fetchSubscriptionDetails = async () => {
    try {
      const sub = await getPushSubscription();
      if (sub) {
        const json = sub.toJSON();
        setSubscriptionDetails({
          endpoint: sub.endpoint,
          expirationTime: sub.expirationTime,
          keys: {
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth
          }
        });
      } else {
        setSubscriptionDetails(null);
      }
    } catch (error) {
      console.error('[Diagnostics] Failed to get subscription:', error);
      setSubscriptionDetails(null);
    }
  };
  
  const [swVersion, setSwVersion] = useState<string | null>(null);
  const [swVersionMismatch, setSwVersionMismatch] = useState(false);

  // Test if SW is actually responding to messages AND check version
  const testServiceWorkerCommunication = async () => {
    setSwTestResult('loading');
    setSwVersion(null);
    setSwVersionMismatch(false);
    
    try {
      if (!('serviceWorker' in navigator)) {
        setSwTestResult('error');
        toast.error('Service Workers not supported');
        return;
      }
      
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) {
        setSwTestResult('error');
        toast.error('No active Service Worker');
        return;
      }
      
      // Send a test message to the SW
      const channel = new MessageChannel();
      
      const responsePromise = new Promise<unknown>((resolve, reject) => {
        channel.port1.onmessage = (event) => {
          console.log('[Diagnostics] SW responded:', event.data);
          resolve(event.data);
        };
        
        setTimeout(() => reject(new Error('SW did not respond within 3 seconds')), 3000);
      });
      
      registration.active.postMessage({ type: 'PING' }, [channel.port2]);
      
      const response = await responsePromise;
      const receivedVersion = response.version || 'unknown';
      setSwVersion(receivedVersion);
      
      // Check version mismatch
      if (receivedVersion !== EXPECTED_SW_VERSION) {
        console.warn('[Diagnostics] SW version mismatch!', {
          expected: EXPECTED_SW_VERSION,
          actual: receivedVersion
        });
        setSwVersionMismatch(true);
        setSwTestResult('error');
        toast.error(`SW version mismatch! Got "${receivedVersion}", expected "${EXPECTED_SW_VERSION}". Click "Clear All" to fix.`);
        return;
      }
      
      setSwTestResult('success');
      toast.success(`✅ Service Worker ${receivedVersion} is alive and up-to-date!`);
    } catch (error: unknown) {
      console.error('[Diagnostics] SW communication test failed:', error);
      setSwTestResult('error');
      toast.error(`❌ SW not responding: ${error.message}`);
    }
  };

  // Capture SW console logs
  useEffect(() => {
    const logs: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.log = (...args) => {
      const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      if (message.includes('[SW]')) {
        logs.push(`LOG: ${message}`);
        setSwLogs([...logs].slice(-10)); // Keep last 10 logs
      }
      originalLog.apply(console, args);
    };
    
    console.warn = (...args) => {
      const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      if (message.includes('[SW]')) {
        logs.push(`WARN: ${message}`);
        setSwLogs([...logs].slice(-10));
      }
      originalWarn.apply(console, args);
    };
    
    console.error = (...args) => {
      const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      if (message.includes('[SW]')) {
        logs.push(`ERROR: ${message}`);
        setSwLogs([...logs].slice(-10));
      }
      originalError.apply(console, args);
    };
    
    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  // Check service worker status
  const checkServiceWorkerStatus = async () => {
    if (!('serviceWorker' in navigator)) {
      setSwStatus({ registered: false, active: false, waiting: false, controller: false, scriptURL: null });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const scriptURL = registration?.active?.scriptURL || registration?.installing?.scriptURL || registration?.waiting?.scriptURL || null;
      setSwStatus({
        registered: !!registration,
        active: !!registration?.active,
        waiting: !!registration?.waiting,
        controller: !!navigator.serviceWorker.controller,
        scriptURL
      });
    } catch (error) {
      console.error('[Diagnostics] SW status check failed:', error);
    }
  };

  // Send a test push notification directly via edge function
  const sendTestPush = async (targetEndpoint?: string) => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }
    
    if (targetEndpoint) {
      setTestingDeviceEndpoint(targetEndpoint);
    } else {
      setTestPushStatus('loading');
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('send-test-push', {
        body: { 
          userId: user.id,
          endpoint: targetEndpoint // Optional: target specific device
        }
      });
      
      if (error) throw error;
      
      if (targetEndpoint) {
        setTestingDeviceEndpoint(null);
        toast.success(`Test push sent to this device!`);
      } else {
        setTestPushStatus('success');
        toast.success(`Test push sent! ${data?.message || ''}`);
      }
    } catch (err: unknown) {
      console.error('[Diagnostics] Test push failed:', err);
      if (targetEndpoint) {
        setTestingDeviceEndpoint(null);
      } else {
        setTestPushStatus('error');
      }
      toast.error(err.message || 'Failed to send test push');
    }
  };

  // Create a test reminder that fires in 2 minutes via the cron job
  const createTestReminder = async () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }
    
    setTestReminderStatus('loading');
    try {
      const now = new Date();
      const fireTime = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes from now
      const dueDate = fireTime.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('reminders')
        .insert({
          user_id: user.id,
          title: `🧪 Test Reminder - ${fireTime.toLocaleTimeString()}`,
          description: 'Created from Diagnostics page to test push notification pipeline',
          due_date: dueDate,
          due_at: fireTime.toISOString(),
          priority: 'high',
          is_completed: false
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setTestReminderStatus('success');
      setTestReminderInfo({
        id: data.id,
        firesAt: fireTime.toLocaleTimeString()
      });
      toast.success(`Test reminder created! Will fire at ${fireTime.toLocaleTimeString()}`);
    } catch (err: unknown) {
      console.error('[Diagnostics] Test reminder failed:', err);
      setTestReminderStatus('error');
      toast.error(err.message || 'Failed to create test reminder');
    }
  };

  // Fetch DB records for current user and check device match
  const fetchDbSubscriptions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setDbSubscriptions(data || []);
    
    // Check if current browser's endpoint matches any DB record
    const currentSub = await getPushSubscription();
    if (currentSub && data) {
      const isRegistered = data.some(sub => sub.endpoint === currentSub.endpoint);
      setIsCurrentDeviceRegistered(isRegistered);
    } else {
      setIsCurrentDeviceRegistered(false);
    }
  };

  // Subscribe this device to push notifications
  const subscribeThisDevice = async () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }
    
    try {
      const success = await subscribePush();
      if (success) {
        toast.success('This device is now registered for push notifications!');
        await fetchDbSubscriptions();
        await fetchSubscriptionDetails();
      } else {
        toast.error('Failed to subscribe this device');
      }
    } catch (err: unknown) {
      toast.error(err.message || 'Subscription failed');
    }
  };

  // Send a local browser notification (no server)
  const sendLocalNotification = () => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🔔 Local Test Notification', {
        body: 'This uses the browser Notification API directly (no server).',
        icon: '/app-icon.png',
        badge: '/app-icon.png',
      });
      toast.success('Local notification sent!');
    } else {
      toast.error('Notification permission not granted');
    }
  };

  // Force complete re-subscription (clears stale subscriptions)
  const forceFullResubscribe = async () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }
    
    setIsResubscribing(true);
    try {
      // Step 1: Unsubscribe from browser's push manager
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
        console.log('[Diagnostics] Browser subscription removed');
      }
      
      // Step 2: Delete ALL database subscriptions for this user
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);
      
      if (deleteError) {
        console.warn('[Diagnostics] DB cleanup error:', deleteError);
      }
      
      // Step 3: Create fresh subscription
      const success = await subscribePush();
      
      if (success) {
        toast.success('Fresh subscription created! Try "Send Test Push" now.');
        // Refresh all data
        await Promise.all([
          fetchDbSubscriptions(),
          fetchSubscriptionDetails()
        ]);
      } else {
        toast.error('Failed to create new subscription');
      }
    } catch (err: unknown) {
      console.error('[Diagnostics] Force resubscribe failed:', err);
      toast.error(err.message || 'Resubscribe failed');
    } finally {
      setIsResubscribing(false);
    }
  };

  // Load push data on mount
  useEffect(() => {
    if (user) {
      fetchSubscriptionDetails();
      fetchDbSubscriptions();
      checkServiceWorkerStatus();
    }
  }, [user]);

  const testEdgeFunction = async (functionName: string) => {
    setTestResults(prev => ({
      ...prev,
      [functionName]: { status: 'loading', message: 'Testing...' }
    }));

    try {
      const body = functionName === 'contact-support' 
        ? { subject: 'Test', body: 'Diagnostics test', requestType: 'technical' }
        : functionName === 'check-due-reminders'
        ? {}
        : { rangeDays: 30, limit: 5 };

      const { data, error } = await supabase.functions.invoke(functionName, { body });

      if (error) {
        setTestResults(prev => ({
          ...prev,
          [functionName]: { status: 'error', message: error.message || JSON.stringify(error) }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          [functionName]: { status: 'success', message: JSON.stringify(data).slice(0, 200) + (JSON.stringify(data).length > 200 ? '...' : '') }
        }));
      }
    } catch (err: unknown) {
      setTestResults(prev => ({
        ...prev,
        [functionName]: { status: 'error', message: err.message || String(err) }
      }));
    }
  };

  const StatusIcon = ({ status }: { status: 'idle' | 'loading' | 'success' | 'error' }) => {
    if (status === 'loading') return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-profit" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-loss" />;
    return null;
  };

  const handleRefreshPush = () => {
    refreshPush();
    fetchSubscriptionDetails();
    fetchDbSubscriptions();
    checkServiceWorkerStatus();
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">App Diagnostics</h1>
        <Badge variant="outline" className="font-mono text-xs">
          Build: {BUILD_ID.slice(0, 19)}
        </Badge>
      </div>

      {/* Environment Info */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Environment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Current URL:</div>
          <div className="font-mono text-xs break-all">{window.location.href}</div>
          
          <div className="text-muted-foreground">Supabase URL:</div>
          <div className="flex items-center gap-2">
            {supabaseUrl ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-profit" />
                <span className="font-mono text-xs">...{supabaseUrl?.slice(-20)}</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-loss" />
                <span className="text-loss">Missing</span>
              </>
            )}
          </div>
          
          <div className="text-muted-foreground">Supabase Key:</div>
          <div className="flex items-center gap-2">
            {supabaseKey ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-profit" />
                <span className="font-mono text-xs">...{supabaseKey?.slice(-8)}</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-loss" />
                <span className="text-loss">Missing</span>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Auth State */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Authentication State</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading auth state...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">User ID:</div>
            <div className="font-mono text-xs break-all">{user?.id || <span className="text-loss">Not logged in</span>}</div>
            
            <div className="text-muted-foreground">Email:</div>
            <div className="font-mono text-xs">{user?.email || '-'}</div>
            
            <div className="text-muted-foreground">Session Expires:</div>
            <div className="font-mono text-xs">{session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : '-'}</div>
            
            <div className="text-muted-foreground">Profile Display Name:</div>
            <div>{profile?.display_name || '-'}</div>
          </div>
        )}
      </Card>

      {/* Role State */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Role State</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">userRole object:</div>
          <div className="font-mono text-xs break-all">{JSON.stringify(userRole)}</div>
          
          <div className="text-muted-foreground">userRole.role:</div>
          <div className="font-mono text-xs">{userRole?.role || <span className="text-loss">null</span>}</div>
          
          <div className="text-muted-foreground">isAdmin:</div>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-profit" />
                <span className="text-profit font-medium">true</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-loss" />
                <span className="text-loss">false</span>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Push Notifications Debug */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Push Notifications Debug
          </h2>
          <Button size="sm" variant="outline" onClick={handleRefreshPush} disabled={pushLoading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${pushLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Browser Support:</div>
          <div className="flex items-center gap-2">
            {pushSupported ? (
              <><CheckCircle2 className="h-4 w-4 text-profit" /><span>Supported</span></>
            ) : (
              <><XCircle className="h-4 w-4 text-loss" /><span>Not Supported</span></>
            )}
          </div>

          <div className="text-muted-foreground">Permission:</div>
          <div>
            <Badge variant={pushPermission === 'granted' ? 'default' : 'secondary'}>
              {pushPermission}
            </Badge>
          </div>

          <div className="text-muted-foreground">Active Subscription:</div>
          <div className="flex items-center gap-2">
            {pushSubscribed ? (
              <><CheckCircle2 className="h-4 w-4 text-profit" /><span>Subscribed</span></>
            ) : (
              <><BellOff className="h-4 w-4 text-muted-foreground" /><span>Not Subscribed</span></>
            )}
          </div>

          <div className="text-muted-foreground">This Device Registered:</div>
          <div className="flex items-center gap-2">
            {isCurrentDeviceRegistered === null ? (
              <><Loader2 className="h-4 w-4 animate-spin" /><span>Checking...</span></>
            ) : isCurrentDeviceRegistered ? (
              <><CheckCircle2 className="h-4 w-4 text-profit" /><span>Yes - Will receive pushes</span></>
            ) : (
              <><AlertTriangle className="h-4 w-4 text-amber-500" /><span className="text-amber-500">No - Subscribe below</span></>
            )}
          </div>

          <div className="text-muted-foreground">Service Worker:</div>
          <div className="font-mono text-xs">
            {'serviceWorker' in navigator ? 'Available' : 'Not Available'}
          </div>

          <div className="text-muted-foreground">SW Registered:</div>
          <div className="flex items-center gap-2">
            {swStatus.registered ? (
              <><CheckCircle2 className="h-4 w-4 text-profit" /><span>Yes</span></>
            ) : (
              <><XCircle className="h-4 w-4 text-loss" /><span>No</span></>
            )}
          </div>

          <div className="text-muted-foreground">SW Active:</div>
          <div className="flex items-center gap-2">
            {swStatus.active ? (
              <><CheckCircle2 className="h-4 w-4 text-profit" /><span>Yes</span></>
            ) : (
              <><XCircle className="h-4 w-4 text-loss" /><span>No - Reload page</span></>
            )}
          </div>

          <div className="text-muted-foreground">SW Script:</div>
          <div className="flex items-center gap-2">
            {swStatus.scriptURL ? (
              <>
                {swStatus.scriptURL.includes(SW_FILENAME) ? (
                  <CheckCircle2 className="h-4 w-4 text-profit" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                <span className="font-mono text-xs">
                  {swStatus.scriptURL.split('/').pop()?.split('?')[0] || 'unknown'}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-xs">Not registered</span>
            )}
          </div>

          <div className="text-muted-foreground">SW Controlling:</div>
          <div className="flex items-center gap-2">
            {swStatus.controller ? (
              <><CheckCircle2 className="h-4 w-4 text-profit" /><span>Yes</span></>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-loss" />
                <span>No</span>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  className="ml-2 h-6 text-xs"
                  onClick={async () => {
                    setIsFixingControl(true);
                    try {
                      toast.loading('Fixing Service Worker control...');
                      const success = await forceServiceWorkerControl();
                      toast.dismiss();
                      
                      if (success) {
                        toast.success('Service Worker fixed! Reloading...');
                        setTimeout(() => window.location.reload(), 1000);
                      } else {
                        toast.error('Please close ALL tabs with this site and reopen');
                      }
                    } catch (error) {
                      toast.dismiss();
                      toast.error('Failed to fix SW control');
                    } finally {
                      setIsFixingControl(false);
                    }
                  }}
                  disabled={isFixingControl}
                >
                  {isFixingControl ? 'Fixing...' : 'Fix Now'}
                </Button>
              </>
            )}
          </div>

          <div className="text-muted-foreground">SW Communication:</div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline"
              className="h-6 text-xs"
              onClick={testServiceWorkerCommunication}
              disabled={swTestResult === 'loading' || !swStatus.active}
            >
              {swTestResult === 'loading' ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Testing...</>
              ) : swTestResult === 'success' ? (
                <><CheckCircle2 className="h-3 w-3 mr-1 text-profit" />Working</>
              ) : swTestResult === 'error' ? (
                <><XCircle className="h-3 w-3 mr-1 text-loss" />Failed</>
              ) : (
                'Test SW'
              )}
            </Button>
            {swVersion && (
              <span className={`text-xs font-mono ${swVersionMismatch ? 'text-loss' : 'text-muted-foreground'}`}>
                {swVersion}
              </span>
            )}
          </div>
          
          {/* Version mismatch warning */}
          {swVersionMismatch && (
            <div className="col-span-2 p-2 bg-loss/10 rounded border border-loss/30 text-xs">
              <div className="flex items-center gap-2 text-loss">
                <AlertTriangle className="h-3 w-3" />
                <span>Stale SW detected! Expected: {EXPECTED_SW_VERSION}</span>
              </div>
              <div className="text-muted-foreground mt-1">
                Click "Clear All" below to force a fresh Service Worker.
              </div>
            </div>
          )}
        </div>

        {/* Subscribe This Device Warning */}
        {isCurrentDeviceRegistered === false && pushPermission === 'granted' && (
          <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-amber-700 dark:text-amber-300">
                  This browser is not registered for push
                </div>
                <div className="text-xs text-muted-foreground">
                  Push notifications will be sent to other registered devices, not this one.
                </div>
              </div>
              <Button size="sm" variant="default" onClick={subscribeThisDevice}>
                <Smartphone className="h-3 w-3 mr-1" />
                Subscribe
              </Button>
            </div>
          </div>
        )}

        {/* Nuclear Option - Clear Everything */}
        <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <div>
              <div className="font-medium text-sm">Clear Everything & Restart</div>
              <div className="text-xs text-muted-foreground">
                Nuclear option: Unregisters SW, clears cache, deletes all subscriptions, reloads page
              </div>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="destructive"
            onClick={async () => {
              if (!confirm('This will clear ALL site data and reload the page. Continue?')) return;
              
              try {
                toast.loading('Performing nuclear reset...');
                
                // 1. Unregister ALL service workers
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(reg => reg.unregister()));
                console.log('[Diagnostics] All SWs unregistered');
                
                // 2. Delete all DB subscriptions
                if (user) {
                  await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
                }
                
                // 3. Clear all caches
                if ('caches' in window) {
                  const cacheNames = await caches.keys();
                  await Promise.all(cacheNames.map(name => caches.delete(name)));
                  console.log('[Diagnostics] All caches cleared');
                }
                
                // 4. Clear localStorage/sessionStorage
                try {
                  localStorage.clear();
                  sessionStorage.clear();
                  console.log('[Diagnostics] Storage cleared');
                } catch (e) {
                  console.warn('[Diagnostics] Could not clear storage:', e);
                }
                
                toast.dismiss();
                toast.success('Nuclear reset complete! Hard reloading...');
                
                // 5. Hard reload with cache-busting URL param
                setTimeout(() => {
                  window.location.href = window.location.pathname + '?nocache=' + Date.now();
                }, 500);
              } catch (err: unknown) {
                toast.dismiss();
                toast.error('Clear failed: ' + err.message);
              }
            }}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        </div>

        {/* Force Full Re-subscribe */}
        <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-4 w-4 text-red-500" />
            <div>
              <div className="font-medium text-sm">Force Full Re-subscribe</div>
              <div className="text-xs text-muted-foreground">
                Clears ALL subscriptions and creates a completely fresh one
              </div>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            className="border-red-500/50 hover:bg-red-500/10 text-red-500"
            onClick={forceFullResubscribe}
            disabled={isResubscribing || pushPermission !== 'granted'}
          >
            {isResubscribing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Reset
          </Button>
        </div>

        {/* Subscription Details */}
        {subscriptionDetails && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="text-xs font-medium">Browser Subscription Endpoint:</div>
            <div className="font-mono text-xs break-all text-muted-foreground">
              {subscriptionDetails.endpoint.slice(0, 80)}...
            </div>
            {subscriptionDetails.keys?.p256dh && (
              <>
                <div className="text-xs font-medium mt-2">p256dh Key (first 20 chars):</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {subscriptionDetails.keys.p256dh.slice(0, 20)}...
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Send Test Push Button */}
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-primary" />
            <div>
              <div className="font-medium text-sm">Send Test Push</div>
              <div className="text-xs text-muted-foreground">
                Sends a push notification directly to your device
              </div>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="default"
            onClick={() => sendTestPush()}
            disabled={testPushStatus === 'loading' || !pushSubscribed}
          >
            {testPushStatus === 'loading' ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Bell className="h-3 w-3 mr-1" />
            )}
            Send to All
          </Button>
        </div>

        {/* Test Local Notification Button */}
        <div className="flex items-center justify-between p-3 bg-profit/10 rounded-lg border border-profit/20">
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-profit" />
            <div>
              <div className="font-medium text-sm">Test Local Notification</div>
              <div className="text-xs text-muted-foreground">
                Uses browser Notification API directly (no server)
              </div>
            </div>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            className="border-profit/50 hover:bg-profit/10"
            onClick={sendLocalNotification}
            disabled={pushPermission !== 'granted'}
          >
            <Bell className="h-3 w-3 mr-1" />
            Test
          </Button>
        </div>

        {/* Create Test Reminder Button */}
        <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-amber-500" />
            <div>
              <div className="font-medium text-sm">Create Test Reminder</div>
              <div className="text-xs text-muted-foreground">
                Creates a reminder that fires in 2 minutes via the cron job
              </div>
              {testReminderInfo && (
                <div className="text-xs text-amber-600 mt-1">
                  Last created: fires at {testReminderInfo.firesAt}
                </div>
              )}
            </div>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            className="border-amber-500/50 hover:bg-amber-500/10"
            onClick={createTestReminder}
            disabled={testReminderStatus === 'loading'}
          >
            {testReminderStatus === 'loading' ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Clock className="h-3 w-3 mr-1" />
            )}
            Create
          </Button>
        </div>

        {/* DB Subscriptions */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Database className="h-3 w-3" />
            Database Records ({dbSubscriptions.length})
          </div>
          {dbSubscriptions.length > 0 ? (
            <div className="space-y-2">
              {dbSubscriptions.map(sub => {
                const isCurrentDevice = subscriptionDetails?.endpoint === sub.endpoint;
                const deviceInfo = getDeviceType(sub.endpoint);
                const isTestingThis = testingDeviceEndpoint === sub.endpoint;
                return (
                  <div key={sub.id} className={`text-xs p-3 rounded-lg ${
                    isCurrentDevice ? 'bg-profit/10 border border-profit/30' : 'bg-muted/30'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="flex items-center gap-2">
                        <span>{deviceInfo.emoji}</span>
                        <span className="font-medium">{deviceInfo.label}</span>
                        {isCurrentDevice && (
                          <Badge variant="outline" className="text-[10px] h-5 bg-profit/20 border-profit/30">
                            This Device
                          </Badge>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono truncate text-muted-foreground">
                        ...{sub.endpoint.slice(-40)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs shrink-0"
                        onClick={() => sendTestPush(sub.endpoint)}
                        disabled={isTestingThis}
                      >
                        {isTestingThis ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-3 w-3 mr-1" />
                            Test
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No subscriptions in database</div>
          )}
        </div>

        {/* Service Worker Console Logs */}
        {swLogs.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              Service Worker Console Logs (Last 10)
            </div>
            <div className="p-3 bg-black/50 rounded-lg font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
              {swLogs.map((log, i) => (
                <div key={i} className={`${
                  log.startsWith('ERROR') ? 'text-red-400' :
                  log.startsWith('WARN') ? 'text-amber-400' :
                  'text-green-400'
                }`}>
                  {log}
                </div>
              ))}
            </div>
            {swLogs.length === 0 && (
              <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
                No SW logs captured yet. Click "Send Test Push" to see if SW receives it.
              </div>
            )}
          </div>
        )}

        {/* Manual Trigger Button */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <StatusIcon status={testResults['check-due-reminders'].status} />
            <div>
              <div className="font-medium text-sm">check-due-reminders</div>
              {testResults['check-due-reminders'].message && (
                <div className="text-xs text-muted-foreground mt-1 max-w-md break-all">
                  {testResults['check-due-reminders'].message}
                </div>
              )}
            </div>
          </div>
          <Button 
            size="sm" 
            variant="default"
            onClick={() => testEdgeFunction('check-due-reminders')}
            disabled={testResults['check-due-reminders'].status === 'loading'}
          >
            <Send className="h-3 w-3 mr-1" />
            Trigger Now
          </Button>
        </div>
      </Card>

      {/* Edge Function Tests */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-foreground">Edge Function Tests</h2>
        
        <div className="space-y-3">
          {/* stripe-sales test */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <StatusIcon status={testResults['stripe-sales'].status} />
              <div>
                <div className="font-medium text-sm">stripe-sales</div>
                {testResults['stripe-sales'].message && (
                  <div className="text-xs text-muted-foreground mt-1 max-w-md break-all">
                    {testResults['stripe-sales'].message}
                  </div>
                )}
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => testEdgeFunction('stripe-sales')}
              disabled={testResults['stripe-sales'].status === 'loading'}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Test
            </Button>
          </div>

          {/* contact-support test */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <StatusIcon status={testResults['contact-support'].status} />
              <div>
                <div className="font-medium text-sm">contact-support</div>
                {testResults['contact-support'].message && (
                  <div className="text-xs text-muted-foreground mt-1 max-w-md break-all">
                    {testResults['contact-support'].message}
                  </div>
                )}
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => testEdgeFunction('contact-support')}
              disabled={testResults['contact-support'].status === 'loading'}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Test
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Links */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Quick Links</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/dashboard">Dashboard</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/admin">Admin</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/sales">Sales</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/settings">Settings</a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/settings/notifications">Notifications</a>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Diagnostics;
