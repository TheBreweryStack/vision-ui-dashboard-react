import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useAccountSettings } from '@/hooks/useAccountSettings';
import { useNotificationPreferences, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { checkBrowserNotificationPermission } from '@/hooks/useLocalAlerts';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useTwoFactor } from '@/hooks/useTwoFactor';
import { useAppSettings } from '@/hooks/useAppSettings';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { User, Palette, LogOut, Save, Loader2, Shield, Camera, Copy, Check, KeyRound, CreditCard, Bell, BellOff, ChevronRight, ChevronDown, FileText, Scale, AlertTriangle, Cookie, Globe, DollarSign, Calendar, TrendingUp, Megaphone, Mail, SendHorizonal, CheckCircle2, Sparkles, Crown, Coffee, BookOpen, MessageSquare, HelpCircle, Smartphone, Inbox, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { EmailSyncSettings } from '@/components/settings/EmailSyncSettings';
import { OnboardingGuide } from '@/components/onboarding/OnboardingGuide';
import { ActiveDevicesSection } from '@/components/notifications/ActiveDevicesSection';
import { TwoFactorSetupModal } from '@/components/auth/TwoFactorSetupModal';

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Toronto', label: 'Toronto (ET)' },
  { value: 'America/Vancouver', label: 'Vancouver (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)' },
];

const Settings: React.FC = () => {
  const { profile, user, signOut, updateProfile } = useAuth();
  const { settings, updateSettings } = useAccountSettings();
  const { is2FAEnabled: is2FAFeatureEnabled } = useAppSettings();
  
  const [displayName, setDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 2FA State - now using hook
  const { 
    checkTwoFactorStatus, 
    disableTwoFactor: disable2FAHook, 
    verifyTotp,
    getTrustedDevices, 
    revokeAllTrustedDevices,
    isLoading: is2FALoading,
    error: twoFactorError,
    errorDetails: twoFactorErrorDetails
  } = useTwoFactor();
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [show2FASetupModal, setShow2FASetupModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [trustedDevices, setTrustedDevices] = useState<Array<{ id: string; device_name: string | null; last_used_at: string }>>([]);
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  
  // Disable 2FA verification flow state
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableVerificationCode, setDisableVerificationCode] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [useBackupForDisable, setUseBackupForDisable] = useState(false);
  const [backupCodeForDisable, setBackupCodeForDisable] = useState('');

  // Email change state
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false);

  // Notification preferences - using centralized hook with auto-save
  const { preferences: notifPrefs, updatePreferences, isSaving: isSavingNotifs } = useNotificationPreferences();
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Push notifications - unified subscription flow
  const { 
    isSubscribed: isPushSubscribed, 
    isLoading: isPushLoading, 
    subscribe: subscribeToPush 
  } = usePushNotifications();
  
  // Browser notifications - simplified from push
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  
  // Check browser notification permission on mount
  useEffect(() => {
    setBrowserPermission(checkBrowserNotificationPermission());
  }, []);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || null);
    }
    check2FAStatus();
  }, [profile, user]);

  // Auto-save toggle handler
  const handleNotifToggle = (key: keyof NotificationPreferences) => {
    updatePreferences({ [key]: !notifPrefs[key] });
  };


  const check2FAStatus = async () => {
    // Check TOTP-based 2FA first
    const totpStatus = await checkTwoFactorStatus();
    if (totpStatus.enabled && totpStatus.verified) {
      setIs2FAEnabled(true);
      // Also load trusted devices
      const devices = await getTrustedDevices();
      setTrustedDevices(devices);
      return;
    }

    // Fallback: check for legacy backup codes
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('backup_codes')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    setIs2FAEnabled(data && data.length > 0);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get signed URL for private bucket
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(fileName, 604800); // 7 days expiry

      if (urlError || !signedUrlData) throw urlError;

      await updateProfile({ avatar_url: signedUrlData.signedUrl });
      setAvatarUrl(signedUrlData.signedUrl);
      toast.success('Avatar updated!');
    } catch (error: unknown) {
      console.error('Avatar upload error:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({ display_name: displayName });
      toast.success('Profile updated!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const generateBackupCodes = (): string[] => {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase() + 
                   '-' + 
                   Math.random().toString(36).substring(2, 8).toUpperCase();
      codes.push(code);
    }
    return codes;
  };

  const hashCode = async (code: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const enable2FA = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate backup codes
      const codes = generateBackupCodes();
      setBackupCodes(codes);

      // Hash and store codes
      const hashedCodes = await Promise.all(
        codes.map(async (code) => ({
          user_id: user.id,
          code_hash: await hashCode(code),
        }))
      );

      // Delete any existing codes
      await supabase
        .from('backup_codes')
        .delete()
        .eq('user_id', user.id);

      // Insert new codes
      const { error } = await supabase
        .from('backup_codes')
        .insert(hashedCodes);

      if (error) throw error;

      setIs2FAEnabled(true);
      setShowBackupCodes(true);
      toast.success('Two-Factor Authentication enabled!');
    } catch (error: unknown) {
      console.error('2FA setup error:', error);
      toast.error('Failed to enable 2FA');
    }
  };

  const handleDisable2FA = async () => {
    const codeToVerify = useBackupForDisable 
      ? backupCodeForDisable.trim().toUpperCase() 
      : disableVerificationCode;
    
    if (!useBackupForDisable && codeToVerify.length !== 6) {
      setDisableError('Please enter a 6-digit code');
      return;
    }
    
    if (useBackupForDisable && !codeToVerify) {
      setDisableError('Please enter a backup code');
      return;
    }
    
    setIsDisabling(true);
    setDisableError(null);
    
    try {
      // Verify the code first (TOTP or backup code)
      const verifyResult = await verifyTotp(codeToVerify, { 
        isSetup: false, 
        useBackupCode: useBackupForDisable 
      });
      
      if (!verifyResult?.success) {
        // Show specific error message from server if available
        if (twoFactorErrorDetails?.code === 'TIME_DRIFT') {
          setDisableError(`Your device clock appears to be off. Please enable "Set time automatically" in your phone settings.`);
        } else if (twoFactorErrorDetails?.message) {
          setDisableError(twoFactorErrorDetails.message);
        } else if (twoFactorError) {
          setDisableError(twoFactorError);
        } else {
          setDisableError(useBackupForDisable ? 'Invalid backup code' : 'Invalid verification code');
        }
        setIsDisabling(false);
        return;
      }
      
      // Code verified - now disable
      const success = await disable2FAHook();
      
      if (success) {
        // Also remove legacy backup codes
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('backup_codes')
            .delete()
            .eq('user_id', user.id);
        }
        
        setIs2FAEnabled(false);
        setBackupCodes([]);
        setTrustedDevices([]);
        setShow2FAModal(false);
        setShowDisableConfirm(false);
        setDisableVerificationCode('');
        setBackupCodeForDisable('');
        setUseBackupForDisable(false);
        toast.success('Two-Factor Authentication disabled');
        await check2FAStatus();
      }
    } catch (error) {
      toast.error('Failed to disable 2FA');
    } finally {
      setIsDisabling(false);
    }
  };
  
  const handleCancelDisable = () => {
    setShowDisableConfirm(false);
    setDisableVerificationCode('');
    setBackupCodeForDisable('');
    setUseBackupForDisable(false);
    setDisableError(null);
  };

  const handleRevokeAllDevices = async () => {
    const success = await revokeAllTrustedDevices();
    if (success) {
      setTrustedDevices([]);
      toast.success('All trusted devices revoked');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const copyAllCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('All codes copied to clipboard');
  };

  const getUserInitials = () => {
    if (displayName) {
      return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return profile?.email?.[0]?.toUpperCase() || 'U';
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const handleManageSubscription = async () => {
    setIsManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      // Handle different response actions
      if (data?.action === 'portal' && data?.url) {
        window.open(data.url, '_blank');
      } else if (data?.action) {
        // Non-portal action - show message as toast
        toast.info(data.message || 'No action needed');
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
        }
      } else if (data?.url) {
        // Fallback for legacy response format
        window.open(data.url, '_blank');
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        toast.info(data?.message || 'No subscription to manage');
      }
    } catch (error: unknown) {
      console.error('Customer portal error:', error);
      toast.error(error.message || 'Failed to open subscription manager');
    } finally {
      setIsManagingSubscription(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      
      if (error) throw error;
      
      setEmailChangeSuccess(true);
      toast.success('Confirmation emails sent!');
    } catch (error: unknown) {
      console.error('Email change error:', error);
      toast.error(error.message || 'Failed to initiate email change');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleCloseEmailModal = () => {
    setShowEmailChangeModal(false);
    setNewEmail('');
    setEmailChangeSuccess(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6 animate-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and preferences</p>
        </div>
      </div>

      {/* Profile Settings */}
      <div className="content-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-box-primary">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Profile</h2>
            <p className="text-sm text-muted-foreground">Your personal information</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center">
            <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingAvatar ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : (
                  <Camera className="h-6 w-6 text-primary" />
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Click the camera icon to upload a profile picture</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    id="email"
                    value={profile?.email || ''}
                    disabled
                    className="bg-secondary/30 border-border/30 text-muted-foreground text-sm truncate w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmailChangeModal(true)}
                  className="shrink-0"
                >
                  Change
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                You'll receive confirmation emails at both addresses.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="bg-secondary/50 border-border/50"
              />
              <p className="text-xs text-muted-foreground">This is how you'll appear across the app.</p>
            </div>
          </div>

          {/* View Getting Started Guide */}
          <div className="pt-4 border-t border-border/50">
            <Button 
              variant="outline" 
              onClick={() => setShowOnboarding(true)}
              className="w-full sm:w-auto"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              View Getting Started Guide
            </Button>
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication - Only show if not disabled by admin */}
      {is2FAFeatureEnabled && (
        <div className="content-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="icon-box-primary">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Two-Factor Authentication</h2>
              <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">2FA Status</span>
                    {is2FAEnabled ? (
                      <Badge className="bg-profit/20 text-profit border-profit/30">Enabled</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {is2FAEnabled 
                      ? 'Your account is protected with authenticator app' 
                      : 'Add an extra layer of security using an authenticator app'}
                  </p>
                </div>
              </div>
              <Button
                variant={is2FAEnabled ? "outline" : "default"}
                onClick={() => is2FAEnabled ? setShow2FAModal(true) : setShow2FASetupModal(true)}
                className={is2FAEnabled ? "border-border" : "bg-primary hover:bg-primary/90"}
                disabled={is2FALoading}
              >
                {is2FALoading ? <Loader2 className="h-4 w-4 animate-spin" /> : is2FAEnabled ? 'Manage' : 'Enable'}
              </Button>
            </div>
          </div>

          {/* Trusted Devices Section */}
          {is2FAEnabled && trustedDevices.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-secondary/30 border border-border/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Trusted Devices</span>
                <Button variant="ghost" size="sm" onClick={handleRevokeAllDevices} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3 mr-1" /> Revoke All
                </Button>
              </div>
              <div className="space-y-2">
                {trustedDevices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{device.device_name || 'Unknown Device'}</span>
                    <span className="text-xs text-muted-foreground">
                      Last used: {new Date(device.last_used_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2FA Setup Modal */}
      <TwoFactorSetupModal 
        open={show2FASetupModal} 
        onOpenChange={setShow2FASetupModal}
        onComplete={() => {
          check2FAStatus();
          setShow2FASetupModal(false);
        }}
      />

      {/* Notification Settings */}
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
            { key: 'announcement_alerts' as const, icon: Megaphone, title: 'Announcements', desc: 'Updates from TraderCafé' },
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

        {/* Browser Notifications - Simplified */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <h3 className="font-medium text-sm text-foreground">Browser Notifications</h3>
              <p className="text-xs text-muted-foreground">
                {browserPermission === null
                  ? 'Not supported in this browser'
                  : browserPermission === 'granted'
                    ? 'You\'ll receive alerts even when the tab is in the background'
                    : browserPermission === 'denied'
                      ? 'Blocked - enable in browser settings'
                      : 'Click to enable notifications'
                }
              </p>
            </div>
          </div>

          {/* Enable button if permission not granted */}
          {browserPermission === 'default' && (
            <Button 
              onClick={async () => {
                setIsRequestingPermission(true);
                try {
                  const permission = await Notification.requestPermission();
                  setBrowserPermission(permission);
                  if (permission === 'granted') {
                    // Auto-subscribe to push notifications when permission granted
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

          {/* Device subscription status */}
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

          {/* Denied state */}
          {browserPermission === 'denied' && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-destructive">
                Notifications are blocked. To enable, click the lock icon in your browser's address bar and allow notifications.
              </p>
            </div>
          )}

          {/* Troubleshooting */}
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

          {/* Active Devices Section - always visible for managing devices */}
          <Separator className="my-4" />
          <ActiveDevicesSection />
        </div>
      </div>

      {/* Timezone Settings */}
      <div className="content-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-box-primary">
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Timezone</h2>
            <p className="text-sm text-muted-foreground">Set your timezone for accurate trade dates</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Your Timezone</Label>
          <Select
            value={settings?.timezone || 'America/New_York'}
            onValueChange={(value) => updateSettings({ timezone: value })}
          >
            <SelectTrigger className="bg-secondary/50 border-border/50">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">This timezone will be used for all trade date calculations.</p>
        </div>
      </div>

      {/* Email Trade Import */}
      <EmailSyncSettings />

      {/* Subscription Management */}
      <div className="content-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-box-primary">
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Subscription</h2>
            <p className="text-sm text-muted-foreground">Manage your billing and subscription</p>
          </div>
        </div>

        {(() => {
          const planStatus = profile?.plan_status || 'free';
          const isComped = profile?.comped_access || false;
          const showManageButton = planStatus === 'monthly' && profile?.stripe_customer_id;
          const showUpgradeButton = planStatus === 'free' || planStatus === 'expired' || planStatus === 'trial';

          if (planStatus === 'lifetime') {
            return (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown className="h-4 w-4 text-amber-500" />
                Lifetime access — no subscription to manage
              </div>
            );
          }

          if (isComped) {
            return (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Comped access — no billing to manage
                </div>
                <Link to="/pricing">
                  <Button variant="outline" size="sm" className="btn-glass border-border">
                    Upgrade anyway
                  </Button>
                </Link>
              </div>
            );
          }

          if (showManageButton) {
            return (
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={isManagingSubscription}
                className="btn-glass border-border"
              >
                {isManagingSubscription ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                Manage Subscription
              </Button>
            );
          }

          if (showUpgradeButton) {
            return (
              <Link to="/pricing">
                <Button className="bg-primary hover:bg-primary/90">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Upgrade
                </Button>
              </Link>
            );
          }

          return null;
        })()}
      </div>


      {/* 2FA Manage Modal */}
      <Dialog open={show2FAModal} onOpenChange={(open) => {
        setShow2FAModal(open);
        if (!open) {
          setShowDisableConfirm(false);
          setDisableVerificationCode('');
          setDisableError(null);
          setShowBackupCodes(false);
        }
      }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {showDisableConfirm ? 'Disable Two-Factor Authentication' : 'Manage Two-Factor Authentication'}
            </DialogTitle>
            <DialogDescription>
              {showDisableConfirm 
                ? 'Enter your authenticator code to disable 2FA'
                : showBackupCodes && backupCodes.length > 0
                  ? 'Save these backup codes in a secure location'
                  : 'Manage your 2FA settings and trusted devices'}
            </DialogDescription>
          </DialogHeader>
          
          {showDisableConfirm ? (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ This will remove 2FA protection from your account. You'll need to set it up again to re-enable.
                </p>
              </div>
              
              <div className="space-y-3">
                {useBackupForDisable ? (
                  <>
                    <Label htmlFor="disable-backup-code">Enter one of your backup codes</Label>
                    <Input
                      id="disable-backup-code"
                      type="text"
                      placeholder="ABC123-DEF456"
                      value={backupCodeForDisable}
                      onChange={(e) => {
                        setBackupCodeForDisable(e.target.value);
                        setDisableError(null);
                      }}
                      className="text-center text-lg tracking-wide font-mono uppercase"
                      autoFocus
                    />
                  </>
                ) : (
                  <>
                    <Label htmlFor="disable-code">Enter 6-digit code from your authenticator app</Label>
                    <Input
                      id="disable-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={disableVerificationCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setDisableVerificationCode(value);
                        setDisableError(null);
                      }}
                      className="text-center text-2xl tracking-widest font-mono"
                      autoFocus
                    />
                  </>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUseBackupForDisable(!useBackupForDisable);
                    setDisableError(null);
                  }}
                  className="w-full text-muted-foreground"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  {useBackupForDisable ? 'Use authenticator code instead' : 'Use a backup code instead'}
                </Button>
              </div>
              
              {disableError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {disableError}
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleCancelDisable}
                  disabled={isDisabling}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDisable2FA}
                  disabled={isDisabling || (!useBackupForDisable && disableVerificationCode.length !== 6) || (useBackupForDisable && !backupCodeForDisable.trim())}
                  variant="destructive"
                  className="flex-1"
                >
                  {isDisabling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Disable'
                  )}
                </Button>
              </div>
            </div>
          ) : showBackupCodes && backupCodes.length > 0 ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm text-yellow-500 font-medium">
                  ⚠️ Save these backup codes in a secure place. They won't be shown again!
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <button
                    key={index}
                    onClick={() => copyCode(code)}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border/50 text-sm font-mono hover:bg-secondary/80 transition-colors"
                  >
                    <span>{code}</span>
                    {copiedCode === code ? (
                      <Check className="h-3 w-3 text-profit" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>
              
              <Button onClick={copyAllCodes} variant="outline" className="w-full">
                <Copy className="h-4 w-4 mr-2" />
                Copy All Codes
              </Button>
              
              <DialogFooter>
                <Button onClick={() => {
                  setShow2FAModal(false);
                  setShowBackupCodes(false);
                }}>
                  I've Saved My Codes
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-profit/10 flex items-center justify-center">
                    <Check className="h-5 w-5 text-profit" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">2FA is enabled</p>
                    <p className="text-xs text-muted-foreground">Your account is protected with an authenticator app</p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Button 
                  onClick={() => setShowDisableConfirm(true)}
                  variant="outline" 
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  Disable 2FA
                </Button>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShow2FAModal(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Change Modal */}
      <Dialog open={showEmailChangeModal} onOpenChange={handleCloseEmailModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Change Email Address
            </DialogTitle>
            <DialogDescription>
              {emailChangeSuccess 
                ? "We've sent confirmation emails to both your old and new email addresses."
                : "Enter your new email address. You'll need to confirm the change via email."}
            </DialogDescription>
          </DialogHeader>
          
          {emailChangeSuccess ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-profit/10 border border-profit/30">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-profit mt-0.5" />
                  <div>
                    <p className="font-medium text-profit">Confirmation emails sent!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Check both <strong>{profile?.email}</strong> and <strong>{newEmail}</strong> for confirmation links. 
                      Your email will update after you confirm both.
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={handleCloseEmailModal} className="w-full">
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentEmail">Current Email</Label>
                <Input
                  id="currentEmail"
                  value={profile?.email || ''}
                  disabled
                  className="bg-secondary/30 border-border/30 text-muted-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newEmail">New Email</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                You'll receive confirmation emails at both your old and new email addresses. 
                The change will only complete after you confirm both.
              </p>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={handleCloseEmailModal}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleEmailChange} 
                  disabled={isChangingEmail || !newEmail}
                >
                  {isChangingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Send Confirmation
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Legal Links Footer */}
      <div className="content-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="icon-box-primary">
            <Scale className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Legal</h2>
            <p className="text-sm text-muted-foreground">View our policies and disclosures</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link 
            to="/terms" 
            className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
          >
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Terms of Service</span>
          </Link>
          <Link 
            to="/privacy" 
            className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
          >
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Privacy Policy</span>
          </Link>
          <Link 
            to="/risk-disclosure" 
            className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
          >
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Risk Disclosure</span>
          </Link>
          <Link 
            to="/cookie-policy" 
            className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
          >
            <Cookie className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Cookie Policy</span>
          </Link>
        </div>
      </div>

      {/* Session - Sign Out */}
      <div className="content-card border-loss/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-box-danger">
            <LogOut className="h-4 w-4 text-loss" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Session</h2>
            <p className="text-sm text-muted-foreground">Manage your current session</p>
          </div>
        </div>

        <Button 
          variant="outline" 
          onClick={handleSignOut}
          className="border-loss/30 text-loss hover:bg-loss/10 hover:text-loss"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-primary hover:bg-primary/90">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* Onboarding Guide Modal */}
      <OnboardingGuide
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
      />
    </div>
  );
};

export default Settings;
