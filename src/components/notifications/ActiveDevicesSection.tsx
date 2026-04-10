import React, { useState } from 'react';
import { usePushSubscriptions, getDeviceType, checkIOSRequirements, getDeviceTypeLabel } from '@/hooks/usePushSubscriptions';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Smartphone, 
  Trash2, 
  SendHorizonal, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  Info,
  Bell,
  HelpCircle,
  ChevronDown,
  Pencil,
  Check,
  X,
  Globe,
  Monitor,
  Tablet
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export const ActiveDevicesSection: React.FC = () => {
  const {
    subscriptions,
    isLoading,
    isTestingDevice,
    isRemovingDevice,
    removeSubscription,
    testSubscription,
    isCurrentDevice,
    updateDeviceLabel,
  } = usePushSubscriptions();

  const { isSubscribed, subscribe, isLoading: subscribing } = usePushNotifications();
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [isSavingLabel, setIsSavingLabel] = useState(false);

  const iosCheck = checkIOSRequirements();

  const handleTest = async (endpoint: string) => {
    setTestResults(prev => ({ ...prev, [endpoint]: null }));
    const result = await testSubscription(endpoint);
    setTestResults(prev => ({ ...prev, [endpoint]: result.success ? 'success' : 'error' }));
    
    if (result.success) {
      toast.success('Test notification sent! Check your device.');
    } else {
      toast.error(result.message || 'Failed to send test notification');
    }
  };

  const handleRemove = async (subscriptionId: string, deviceLabel: string) => {
    const success = await removeSubscription(subscriptionId);
    if (success) {
      toast.success(`${deviceLabel} device removed`);
    } else {
      toast.error('Failed to remove device');
    }
  };

  const handleStartEdit = (sub: { id: string; device_label: string | null }) => {
    setEditingId(sub.id);
    setEditLabel(sub.device_label || '');
  };

  const handleSaveLabel = async (subscriptionId: string) => {
    if (!editLabel.trim()) {
      toast.error('Please enter a device name');
      return;
    }
    
    setIsSavingLabel(true);
    const success = await updateDeviceLabel(subscriptionId, editLabel.trim());
    setIsSavingLabel(false);
    
    if (success) {
      toast.success('Device name updated');
      setEditingId(null);
    } else {
      toast.error('Failed to update device name');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
  };

  const getDeviceTypeIcon = (deviceType?: 'mobile' | 'tablet' | 'desktop') => {
    switch (deviceType) {
      case 'mobile': return <Smartphone className="h-3 w-3" />;
      case 'tablet': return <Tablet className="h-3 w-3" />;
      case 'desktop': return <Monitor className="h-3 w-3" />;
      default: return <Smartphone className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Smartphone className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Active Devices</h2>
          <p className="text-sm text-muted-foreground">
            {subscriptions.length} device{subscriptions.length !== 1 ? 's' : ''} registered
          </p>
        </div>
      </div>

      {/* iOS Requirements Check */}
      {iosCheck.isIOS && (!iosCheck.meetsVersion || !iosCheck.isHomeScreen) && (
        <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-warning">iOS Requirements Not Met</p>
              <ul className="mt-1 space-y-1 text-muted-foreground">
                {!iosCheck.meetsVersion && (
                  <li className="flex items-center gap-1">
                    <span className="text-loss">✗</span> iOS 16.4+ required (you have {iosCheck.versionNumber || 'unknown'})
                  </li>
                )}
                {!iosCheck.isHomeScreen && (
                  <li className="flex items-center gap-1">
                    <span className="text-loss">✗</span> Add to Home Screen required
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Show "Enable on This Device" banner if other devices exist but current device is not registered */}
      {subscriptions.length > 0 && !subscriptions.some(sub => isCurrentDevice(sub.endpoint)) && (
        <div className="mb-4 p-3 rounded-lg border border-warning/30 bg-warning/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-sm font-medium text-warning">This device is not registered</p>
              <p className="text-xs text-muted-foreground">Enable notifications to receive alerts here</p>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={async () => {
              const success = await subscribe();
              if (success) {
                toast.success('Notifications enabled on this device!');
              } else {
                toast.error('Failed to enable notifications');
              }
            }}
            disabled={subscribing}
          >
            {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
            {subscribing ? '' : 'Enable'}
          </Button>
        </div>
      )}

      {subscriptions.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <Bell className="h-10 w-10 mx-auto text-muted-foreground/50 mb-4" />
          <p className="font-medium text-foreground">No devices registered yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Enable the toggle above to start receiving push notifications on this device
          </p>
          <Button 
            size="sm" 
            onClick={async () => {
              const success = await subscribe();
              if (success) {
                toast.success('Notifications enabled!');
              } else {
                toast.error('Failed to enable notifications');
              }
            }}
            disabled={subscribing}
          >
            {subscribing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
            {subscribing ? 'Enabling...' : 'Enable Notifications'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => {
            const deviceInfo = getDeviceType(sub.endpoint, sub.device_metadata);
            const isThisDevice = isCurrentDevice(sub.endpoint);
            const isTesting = isTestingDevice === sub.endpoint;
            const isRemoving = isRemovingDevice === sub.id;
            const testResult = testResults[sub.endpoint];
            const isEditing = editingId === sub.id;
            const shortId = sub.device_id?.slice(-4) || '';

            return (
              <div
                key={sub.id}
                className={cn(
                  "p-3 rounded-lg border transition-colors",
                  isThisDevice 
                    ? "bg-primary/5 border-primary/20" 
                    : "bg-muted/30 border-border"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="text-2xl shrink-0">{deviceInfo.icon}</div>
                    <div className="min-w-0 flex-1">
                      {/* Device Name - Editable */}
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="h-7 text-sm"
                            placeholder="Device name..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveLabel(sub.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleSaveLabel(sub.id)}
                            disabled={isSavingLabel}
                          >
                            {isSavingLabel ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-profit" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">
                            {sub.device_label || deviceInfo.label}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 opacity-50 hover:opacity-100"
                            onClick={() => handleStartEdit({ id: sub.id, device_label: sub.device_label || deviceInfo.label })}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {isThisDevice && (
                            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                              This Device
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Rich Metadata */}
                      {deviceInfo.os && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            {getDeviceTypeIcon(deviceInfo.deviceType)}
                            {getDeviceTypeLabel(deviceInfo.deviceType || 'desktop')}
                          </span>
                          <span>•</span>
                          <span>{deviceInfo.browser} {deviceInfo.browserVersion?.split('.')[0]}</span>
                          <span>•</span>
                          <span>{deviceInfo.os} {deviceInfo.osVersion?.split('.')[0]}</span>
                          {deviceInfo.timezone && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                {deviceInfo.timezone.split('/').pop()?.replace(/_/g, ' ')}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Registration info */}
                      <p className="text-xs text-muted-foreground mt-1">
                        Registered {format(new Date(sub.created_at), 'MMM d, yyyy')}
                        {shortId && (
                          <span className="ml-2 font-mono text-[10px] text-muted-foreground/60">
                            ID: {shortId}
                          </span>
                        )}
                      </p>
                      {sub.last_successful_push_at && (
                        <p className="text-xs text-muted-foreground/70">
                          Last push: {format(new Date(sub.last_successful_push_at), 'MMM d, h:mm a')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Test Result Icon */}
                    {testResult === 'success' && (
                      <CheckCircle2 className="h-4 w-4 text-profit" />
                    )}
                    {testResult === 'error' && (
                      <AlertCircle className="h-4 w-4 text-loss" />
                    )}

                    {/* Test Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => handleTest(sub.endpoint)}
                      disabled={isTesting || isRemoving}
                    >
                      {isTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SendHorizonal className="h-4 w-4" />
                      )}
                      <span className="sr-only">Test</span>
                    </Button>

                    {/* Remove Button with Confirmation */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground hover:text-loss"
                          disabled={isTesting || isRemoving}
                        >
                          {isRemoving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="sr-only">Remove</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Device?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {isThisDevice 
                              ? "This will disable notifications on this device. You can re-enable them anytime."
                              : `This will remove the ${sub.device_label || deviceInfo.label} device from receiving notifications.`
                            }
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(sub.id, sub.device_label || deviceInfo.label)}
                            className="bg-loss hover:bg-loss/90"
                          >
                            Remove Device
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-start gap-2">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Each browser or device you enable notifications on will be registered here. 
          Use "Test" to verify notifications are working. Click the pencil to rename devices.
        </p>
      </div>

      {/* Troubleshooting Section */}
      <Collapsible className="mt-4">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
          <HelpCircle className="h-4 w-4" />
          <span>Having trouble with notifications?</span>
          <ChevronDown className="h-4 w-4 ml-auto transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-2 text-sm text-muted-foreground pl-6">
          <p>• Make sure browser notifications are allowed in your system settings</p>
          <p>• Try refreshing the page and enabling again</p>
          <p>• On iOS Safari, add this app to your Home Screen first (requires iOS 16.4+)</p>
          <p>• Clear browser cache if notifications were working before</p>
          <p>• Some browsers block notifications in private/incognito mode</p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
