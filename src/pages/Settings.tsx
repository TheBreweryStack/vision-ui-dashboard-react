import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useAccountSettings } from '@/hooks/useAccountSettings';
import { useTwoFactor } from '@/hooks/useTwoFactor';
import { useAppSettings } from '@/hooks/useAppSettings';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, LogOut, Save, Loader2, Shield, Camera, KeyRound, Globe, BookOpen, FileText, Scale, AlertTriangle, Cookie, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { EmailSyncSettings } from '@/components/settings/EmailSyncSettings';
import { NotificationSection } from '@/components/settings/NotificationSection';
import { SubscriptionSection } from '@/components/settings/SubscriptionSection';
import { TwoFactorManageModal } from '@/components/settings/TwoFactorManageModal';
import { EmailChangeModal } from '@/components/settings/EmailChangeModal';
import { OnboardingGuide } from '@/components/onboarding/OnboardingGuide';
import { TwoFactorSetupModal } from '@/components/auth/TwoFactorSetupModal';
import { logger } from '@/lib/logger';

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

  // 2FA State
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

  // Disable 2FA verification flow
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

  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setAvatarUrl(profile.avatar_url || null);
    }
    check2FAStatus();
  }, [profile, user]);

  const check2FAStatus = async () => {
    const totpStatus = await checkTwoFactorStatus();
    if (totpStatus.enabled && totpStatus.verified) {
      setIs2FAEnabled(true);
      const devices = await getTrustedDevices();
      setTrustedDevices(devices);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('backup_codes')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    setIs2FAEnabled(data && data.length > 0);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be less than 2MB'); return; }

    setIsUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: signedUrlData, error: urlError } = await supabase.storage.from('avatars').createSignedUrl(fileName, 604800);
      if (urlError || !signedUrlData) throw urlError;
      await updateProfile({ avatar_url: signedUrlData.signedUrl });
      setAvatarUrl(signedUrlData.signedUrl);
      toast.success('Avatar updated!');
    } catch (error: unknown) {
      logger.error('Avatar upload error:', error);
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

  const handleDisable2FA = async () => {
    const codeToVerify = useBackupForDisable ? backupCodeForDisable.trim().toUpperCase() : disableVerificationCode;
    if (!useBackupForDisable && codeToVerify.length !== 6) { setDisableError('Please enter a 6-digit code'); return; }
    if (useBackupForDisable && !codeToVerify) { setDisableError('Please enter a backup code'); return; }

    setIsDisabling(true);
    setDisableError(null);
    try {
      const verifyResult = await verifyTotp(codeToVerify, { isSetup: false, useBackupCode: useBackupForDisable });
      if (!verifyResult?.success) {
        if (twoFactorErrorDetails?.code === 'TIME_DRIFT') {
          setDisableError('Your device clock appears to be off. Please enable "Set time automatically" in your phone settings.');
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
      const success = await disable2FAHook();
      if (success) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) { await supabase.from('backup_codes').delete().eq('user_id', user.id); }
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
    if (success) { setTrustedDevices([]); toast.success('All trusted devices revoked'); }
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
    if (displayName) return displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return profile?.email?.[0]?.toUpperCase() || 'U';
  };

  const handleEmailChange = async () => {
    if (!newEmail || !newEmail.includes('@')) { toast.error('Please enter a valid email address'); return; }
    setIsChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setEmailChangeSuccess(true);
      toast.success('Confirmation emails sent!');
    } catch (error: unknown) {
      logger.error('Email change error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to initiate email change');
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

      {/* Profile */}
      <div className="content-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-box-primary"><User className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Profile</h2>
            <p className="text-sm text-muted-foreground">Your personal information</p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex flex-col items-center">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">{getUserInitials()}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingAvatar ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Camera className="h-6 w-6 text-primary" />}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Click the camera icon to upload a profile picture</p>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <Input id="email" value={profile?.email || ''} disabled className="bg-secondary/30 border-border/30 text-muted-foreground text-sm truncate w-full" />
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowEmailChangeModal(true)} className="shrink-0">Change</Button>
              </div>
              <p className="text-xs text-muted-foreground">You'll receive confirmation emails at both addresses.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your display name" className="bg-secondary/50 border-border/50" />
              <p className="text-xs text-muted-foreground">This is how you'll appear across the app.</p>
            </div>
          </div>
          <div className="pt-4 border-t border-border/50">
            <Button variant="outline" onClick={() => setShowOnboarding(true)} className="w-full sm:w-auto">
              <BookOpen className="h-4 w-4 mr-2" />View Getting Started Guide
            </Button>
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      {is2FAFeatureEnabled && (
        <div className="content-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="icon-box-primary"><Shield className="h-4 w-4 text-primary" /></div>
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
                    {is2FAEnabled ? <Badge className="bg-profit/20 text-profit border-profit/30">Enabled</Badge> : <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {is2FAEnabled ? 'Your account is protected with authenticator app' : 'Add an extra layer of security using an authenticator app'}
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
                    <span className="text-xs text-muted-foreground">Last used: {new Date(device.last_used_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <TwoFactorSetupModal open={show2FASetupModal} onOpenChange={setShow2FASetupModal} onComplete={() => { check2FAStatus(); setShow2FASetupModal(false); }} />

      <NotificationSection />

      {/* Timezone */}
      <div className="content-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-box-primary"><Globe className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Timezone</h2>
            <p className="text-sm text-muted-foreground">Set your timezone for accurate trade dates</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Your Timezone</Label>
          <Select value={settings?.timezone || 'America/New_York'} onValueChange={(value) => updateSettings({ timezone: value })}>
            <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="Select timezone" /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (<SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">This timezone will be used for all trade date calculations.</p>
        </div>
      </div>

      <EmailSyncSettings />
      <SubscriptionSection />

      {/* Legal */}
      <div className="content-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="icon-box-primary"><Scale className="h-4 w-4 text-primary" /></div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Legal</h2>
            <p className="text-sm text-muted-foreground">View our policies and disclosures</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: '/terms', icon: FileText, label: 'Terms of Service' },
            { to: '/privacy', icon: Shield, label: 'Privacy Policy' },
            { to: '/risk-disclosure', icon: AlertTriangle, label: 'Risk Disclosure' },
            { to: '/cookie-policy', icon: Cookie, label: 'Cookie Policy' },
          ].map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Session */}
      <div className="content-card border-loss/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-box-danger"><LogOut className="h-4 w-4 text-loss" /></div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Session</h2>
            <p className="text-sm text-muted-foreground">Manage your current session</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => signOut().catch(() => toast.error('Failed to sign out'))} className="border-loss/30 text-loss hover:bg-loss/10 hover:text-loss">
          <LogOut className="h-4 w-4 mr-2" />Sign Out
        </Button>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSaveProfile} disabled={isSaving} className="bg-primary hover:bg-primary/90">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {/* Modals */}
      <TwoFactorManageModal
        open={show2FAModal}
        onOpenChange={setShow2FAModal}
        showDisableConfirm={showDisableConfirm}
        setShowDisableConfirm={setShowDisableConfirm}
        showBackupCodes={showBackupCodes}
        backupCodes={backupCodes}
        copiedCode={copiedCode}
        disableVerificationCode={disableVerificationCode}
        setDisableVerificationCode={setDisableVerificationCode}
        backupCodeForDisable={backupCodeForDisable}
        setBackupCodeForDisable={setBackupCodeForDisable}
        useBackupForDisable={useBackupForDisable}
        setUseBackupForDisable={setUseBackupForDisable}
        disableError={disableError}
        setDisableError={setDisableError}
        isDisabling={isDisabling}
        onDisable2FA={handleDisable2FA}
        onCancelDisable={handleCancelDisable}
        onCopyCode={copyCode}
        onCopyAllCodes={copyAllCodes}
        onCloseModal={() => { setShow2FAModal(false); setShowBackupCodes(false); }}
      />

      <EmailChangeModal
        open={showEmailChangeModal}
        onClose={handleCloseEmailModal}
        currentEmail={profile?.email || ''}
        newEmail={newEmail}
        setNewEmail={setNewEmail}
        isChangingEmail={isChangingEmail}
        emailChangeSuccess={emailChangeSuccess}
        onSubmit={handleEmailChange}
      />

      <OnboardingGuide open={showOnboarding} onOpenChange={setShowOnboarding} />
    </div>
  );
};

export default Settings;
