import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bell, BellOff, ChevronDown, DollarSign, Calendar, TrendingUp, Megaphone, Mail, Loader2, CheckCircle2, HelpCircle, Smartphone, MessageSquare, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNotificationPreferences, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { checkBrowserNotificationPermission } from '@/hooks/useLocalAlerts';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { ActiveDevicesSection } from '@/components/notifications/ActiveDevicesSection';

export const NotificationSection: React.FC = () => {
  const { preferences: notifPrefs, updatePreferences, isSaving: isSavingNotifs } = useNotificationPreferences();
  const {
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
    subscribe: subscribeToPush,
  } = usePushNotifications();

  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  useEffect(() => {
    setBrowserPermission(checkBrowserNotificationPermission());
  }, []);

  const handleNotifToggle = (key: keyof NotificationPreferences) => {
    updatePreferences({ [key]: !notifPrefs[key] });
  };

  return (
    <div className="content-card">
      <div className="flex items-center gap-3 mb-6">
        <div className="icon-box-primary">
          <Bell className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          <p className="text-sm text-muted-foreground">Configure alerts and in-app notifications</p>
        </div>
        {isSavingNotifs && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
      </div>

      {/* In-App Notifications */}
      <div className="space-y-1 mb-4">
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors">
          <div className="flex items-center gap-3">
            <BellOff className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="mute_all" className="font-medium text-sm text-foreground cursor-pointer">Mute all notifications</Label>
              <p className="text-xs text-muted-foreground">Pause all in-app alerts temporarily</p>
            </div>
          </div>
          <Switch
            id="mute_all"
            checked={notifPrefs.mute_all_notifications}
            onCheckedChange={() => handleNotifToggle('mute_all_notifications')}
          />
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors">
          <div className={cn("flex items-center gap-3", notifPrefs.mute_all_notifications && "opacity-50")}>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="toast_banners" className="font-medium text-sm text-foreground cursor-pointer">Show toast banners</Label>
              <p className="text-xs text-muted-foreground">Pop-up notifications when alerts arrive</p>
            </div>
          </div>
          <Switch
            id="toast_banners"
            checked={notifPrefs.show_toast_banners}
            onCheckedChange={() => handleNotifToggle('show_toast_banners')}
            disabled={notifPrefs.mute_all_notifications}
          />
        </div>
      </div>

      <Separator className="my-4" />

      {/* Alert Types */}
      <div className="space-y-1">
        {[
          { key: 'price_alerts' as const, icon: DollarSign, title: 'Price Alerts', desc: 'Stock hits your price target' },
          { key: 'reminder_alerts' as const, icon: Calendar, title: 'Reminder Alerts', desc: 'Scheduled trading tasks' },
          { key: 'inbox_alerts' as const, icon: Inbox, title: 'Trade Inbox', desc: 'New trades from email sync' },
          { key: 'trade_updates' as const, icon: TrendingUp, title: 'Trade Updates', desc: 'Open positions and trades' },
          { key: 'announcement_alerts' as const, icon: Megaphone, title: 'Announcements', desc: 'Updates from TraderCafe' },
          { key: 'weekly_summary' as const, icon: Mail, title: 'Weekly Summary', desc: 'Weekly performance digest' },
        ].map(({ key, icon: Icon, title, desc }) => (
          <div key={key} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors">
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor={key} className="font-medium text-sm text-foreground cursor-pointer">{title}</Label>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
            <Switch id={key} checked={notifPrefs[key]} onCheckedChange={() => handleNotifToggle(key)} />
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      {/* Browser Notifications */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <h3 className="font-medium text-sm text-foreground">Browser Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {browserPermission === null
                ? 'Not supported in this browser'
                : browserPermission === 'granted'
                  ? "You'll receive alerts even when the tab is in the background"
                  : browserPermission === 'denied'
                    ? 'Blocked - enable in browser settings'
                    : 'Click to enable notifications'
              }
            </p>
          </div>
        </div>

        {browserPermission === 'default' && (
          <Button
            onClick={async () => {
              setIsRequestingPermission(true);
              try {
                const permission = await Notification.requestPermission();
                setBrowserPermission(permission);
                if (permission === 'granted') {
                  const subscribed = await subscribeToPush();
                  if (subscribed) {
                    toast.success('Push notifications enabled on this device!');
                  } else {
                    toast.success('Notifications enabled!');
                  }
                } else if (permission === 'denied') {
                  toast.error('Notifications blocked. Check your browser settings.');
                }
              } finally {
                setIsRequestingPermission(false);
              }
            }}
            disabled={isRequestingPermission}
            className="w-full"
          >
            {isRequestingPermission ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Bell className="h-4 w-4 mr-2" />
            )}
            {isRequestingPermission ? 'Enabling...' : 'Enable Notifications'}
          </Button>
        )}

        {browserPermission === 'granted' && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">This Device</p>
                <p className="text-xs text-muted-foreground">
                  {isPushLoading ? 'Checking...' : isPushSubscribed ? 'Registered for push alerts' : 'Not registered'}
                </p>
              </div>
            </div>
            {isPushSubscribed && (
              <Badge variant="outline" className="text-[10px] text-profit border-profit/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
        )}

        {browserPermission === 'denied' && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive">
              Notifications are blocked. To enable, click the lock icon in your browser's address bar and allow notifications.
            </p>
          </div>
        )}

        <Collapsible open={showTroubleshooting} onOpenChange={setShowTroubleshooting}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
              <span className="flex items-center gap-2">
                <HelpCircle className="h-3.5 w-3.5" />
                Troubleshooting
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showTroubleshooting && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            <div className="p-3 rounded-lg bg-secondary/30 text-xs text-muted-foreground space-y-2">
              <p><strong>How notifications work:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Notifications appear when the app is open in your browser</li>
                <li>Sound and vibration work even if the tab is in the background</li>
                <li>Browser notifications show when the tab is minimized</li>
                <li>Make sure your browser's notification permissions are enabled</li>
                <li>On macOS, set notification style to "Banners" or "Alerts" in System Settings</li>
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator className="my-4" />
        <ActiveDevicesSection />
      </div>
    </div>
  );
};
