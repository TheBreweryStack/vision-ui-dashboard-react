import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Key, Shield, Sparkles, AlertTriangle, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UserWithRole {
  id: string;
  email?: string | null;
  display_name?: string | null;
  role?: string;
}

interface UserFeature {
  id: string;
  feature_name: string;
  enabled: boolean;
}

const AVAILABLE_FEATURES = [
  { name: 'dashboard', label: 'Dashboard', description: 'Access to main dashboard' },
  { name: 'journal', label: 'Journal', description: 'Trade journaling features' },
  { name: 'analytics', label: 'Analytics', description: 'Performance analytics & reports' },
  { name: 'watchlist', label: 'Watchlist', description: 'Stock watchlists with alerts' },
  { name: 'reminders', label: 'Reminders', description: 'Trading reminders' },
  { name: 'notes', label: 'Notes', description: 'Research notes' },
  { name: 'market', label: 'Market', description: 'Market data & overview' },
  { name: 'ai_analysis', label: 'AI Coach', description: 'AI-powered trade analysis' },
];

interface UserActionsModalProps {
  user: UserWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export const UserActionsModal: React.FC<UserActionsModalProps> = ({
  user,
  open,
  onOpenChange,
  onUpdate,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isResetting2FA, setIsResetting2FA] = useState(false);
  const [features, setFeatures] = useState<UserFeature[]>([]);
  const [featureChanges, setFeatureChanges] = useState<Record<string, boolean>>({});
  const [has2FAEnabled, setHas2FAEnabled] = useState<boolean | null>(null);
  const [is2FALoading, setIs2FALoading] = useState(false);

  useEffect(() => {
    if (user && open) {
      fetchUserFeatures();
      fetch2FAStatus();
    }
  }, [user, open]);

  const fetch2FAStatus = async () => {
    if (!user) return;
    setIs2FALoading(true);
    
    try {
      const { data, error } = await supabase
        .from('totp_secrets')
        .select('verified')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setHas2FAEnabled(data?.verified ?? false);
    } catch (error) {
      console.error('Error fetching 2FA status:', error);
      setHas2FAEnabled(null);
    } finally {
      setIs2FALoading(false);
    }
  };

  const fetchUserFeatures = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('user_features')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setFeatures(data || []);
      
      // Initialize feature changes with current values
      const changes: Record<string, boolean> = {};
      AVAILABLE_FEATURES.forEach(f => {
        const existing = data?.find(uf => uf.feature_name === f.name);
        changes[f.name] = existing?.enabled ?? false;
      });
      setFeatureChanges(changes);
    } catch (error) {
      console.error('Error fetching user features:', error);
      toast.error('Failed to load user features');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) {
      toast.error('User has no email address');
      return;
    }
    
    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) throw error;
      toast.success(`Password reset email sent to ${user.email}`);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to send password reset email');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleReset2FA = async () => {
    if (!user) return;
    
    const confirmed = confirm(
      `This will completely remove 2FA for ${user.display_name || user.email}:\n\n` +
      `• TOTP secret (authenticator app)\n` +
      `• All backup codes\n` +
      `• All trusted devices\n\n` +
      `The user will need to set up 2FA again from scratch.\n\n` +
      `Are you sure you want to proceed?`
    );
    
    if (!confirmed) return;
    
    setIsResetting2FA(true);
    try {
      console.log('[UserActionsModal] Calling admin-reset-2fa for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('admin-reset-2fa', {
        body: { userId: user.id }
      });
      
      console.log('[UserActionsModal] Response:', { data, error });
      
      // Handle invoke error
      if (error) {
        console.error('[UserActionsModal] Invoke error:', error);
        throw error;
      }
      
      // Handle null data (function not found or other issues)
      if (!data) {
        throw new Error('No response from server - function may not be deployed');
      }
      
      // Handle explicit failure from function
      if (!data.success) {
        throw new Error(data.error || 'Reset failed - unknown error');
      }
      
      // Success! Show what was deleted
      const deleted = data.deleted || {};
      console.log('[UserActionsModal] 2FA reset successful:', deleted);
      
      toast.success(
        `2FA reset complete. Removed ${deleted.totpSecrets || 0} secret(s), ` +
        `${deleted.backupCodes || 0} backup code(s), ${deleted.trustedDevices || 0} device(s).`
      );
      
      // Refresh 2FA status to confirm
      await fetch2FAStatus();
      
      onUpdate?.();
    } catch (error: unknown) {
      console.error('[UserActionsModal] Error resetting 2FA:', error);
      toast.error(error?.message || 'Failed to reset 2FA');
    } finally {
      setIsResetting2FA(false);
    }
  };

  const handleFeatureToggle = (featureName: string, enabled: boolean) => {
    setFeatureChanges(prev => ({ ...prev, [featureName]: enabled }));
  };

  const handleSaveFeatures = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      
      for (const [featureName, enabled] of Object.entries(featureChanges)) {
        const existing = features.find(f => f.feature_name === featureName);
        
        if (existing) {
          await supabase
            .from('user_features')
            .update({ enabled })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('user_features')
            .insert({
              user_id: user.id,
              feature_name: featureName,
              enabled,
              granted_by: adminUser?.id,
            });
        }
      }
      
      toast.success('Features updated successfully');
      onUpdate?.();
    } catch (error) {
      console.error('Error updating features:', error);
      toast.error('Failed to update features');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Manage User: {user.display_name || user.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Info */}
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div className="mt-3 space-y-1">
              <p className="text-sm text-muted-foreground">Role</p>
              <Badge className={cn(
                "capitalize",
                user.role === 'admin' ? 'bg-profit/10 text-profit border-profit/30' : 'bg-secondary'
              )}>
                {user.role}
              </Badge>
            </div>
          </div>

          {/* Security Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Key className="h-4 w-4" />
              Security Actions
            </h3>
            
            {/* 2FA Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-2">
                {is2FALoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : has2FAEnabled ? (
                  <ShieldCheck className="h-4 w-4 text-profit" />
                ) : (
                  <ShieldOff className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">Two-Factor Authentication</span>
              </div>
              <Badge className={cn(
                has2FAEnabled 
                  ? 'bg-profit/10 text-profit border-profit/30' 
                  : 'bg-secondary text-muted-foreground'
              )}>
                {is2FALoading ? 'Checking...' : has2FAEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleResetPassword}
                disabled={isResettingPassword}
                className="flex-1"
              >
                {isResettingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                Reset Password
              </Button>
              <Button
                variant="outline"
                onClick={handleReset2FA}
                disabled={isResetting2FA || !has2FAEnabled}
                className={cn(
                  "flex-1",
                  has2FAEnabled && "text-loss hover:text-loss border-loss/30 hover:border-loss/50"
                )}
              >
                {isResetting2FA ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                Reset 2FA
              </Button>
            </div>
          </div>

          {/* Feature Access */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Feature Access
            </h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {AVAILABLE_FEATURES.map(feature => (
                  <div
                    key={feature.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                  >
                    <div>
                      <p className="font-medium">{feature.label}</p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                    <Switch
                      checked={featureChanges[feature.name] ?? false}
                      onCheckedChange={(checked) => handleFeatureToggle(feature.name, checked)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveFeatures}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserActionsModal;
