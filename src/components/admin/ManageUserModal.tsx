import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Key, Shield, Sparkles, AlertTriangle, Crown, Gift, Calendar, Info, Star, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, addDays, isPast } from 'date-fns';
import { computeHasFullAccess } from '@/hooks/useAccessControl';
import { PlanBadge, RoleBadge, UserBadges } from '@/components/common/PlanBadge';
import { logger } from '@/lib/logger';

interface ExtendedProfile {
  id: string;
  email?: string | null;
  display_name?: string | null;
  created_at: string;
  plan_status: string;
  trial_ends_at?: string | null;
  comped_access: boolean;
  comped_reason?: string | null;
  comped_by?: string | null;
  comped_at?: string | null;
  early_supporter: boolean;
  subscription_tier?: string | null;
  role?: string;
}

interface UserFeature {
  id: string;
  feature_name: string;
  enabled: boolean;
}

const ADVANCED_FEATURES = [
  { name: 'ai_coach', label: 'AI Coach (beta)', description: 'AI-powered trade analysis' },
  { name: 'market_data', label: 'Market Data', description: 'Real-time market overview' },
  { name: 'csv_import_export', label: 'CSV Import/Export', description: 'Bulk import/export trades' },
];

interface ManageUserModalProps {
  user: ExtendedProfile | null;
  currentAdminIsOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export const ManageUserModal: React.FC<ManageUserModalProps> = ({
  user,
  currentAdminIsOwner,
  open,
  onOpenChange,
  onUpdate,
}) => {
  const { user: authUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [selectedRole, setSelectedRole] = useState<string>('user');
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [trialEndsAt, setTrialEndsAt] = useState<string>('');
  const [compedAccess, setCompedAccess] = useState(false);
  const [compedReason, setCompedReason] = useState('');
  
  // Feature overrides
  const [features, setFeatures] = useState<UserFeature[]>([]);
  const [featureOverrides, setFeatureOverrides] = useState<Record<string, boolean | null>>({});
  
  // Confirmation dialogs
  const [showRoleConfirm, setShowRoleConfirm] = useState(false);
  const [showLifetimeConfirm, setShowLifetimeConfirm] = useState(false);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  
  // Security actions
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isResetting2FA, setIsResetting2FA] = useState(false);
  const [showSecurityConfirm, setShowSecurityConfirm] = useState(false);
  const [securityAction, setSecurityAction] = useState<'password' | '2fa' | 'email' | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  
  // Email update state
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const fetchUserFeatures = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('user_features')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setFeatures(data || []);
      
      // Initialize overrides (null = inherit from plan)
      const overrides: Record<string, boolean | null> = {};
      ADVANCED_FEATURES.forEach(f => {
        const existing = data?.find(uf => uf.feature_name === f.name);
        overrides[f.name] = existing ? existing.enabled : null;
      });
      setFeatureOverrides(overrides);
    } catch (error) {
      logger.error('Error fetching user features:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && open) {
      setSelectedRole(user.role || 'user');
      setSelectedPlan(user.plan_status || 'free');
      setTrialEndsAt(user.trial_ends_at ? format(new Date(user.trial_ends_at), 'yyyy-MM-dd') : '');
      setCompedAccess(user.comped_access || false);
      setCompedReason(user.comped_reason || '');
      fetchUserFeatures();
    }
  }, [user, open, fetchUserFeatures]);

  const isTargetOwner = user?.role === 'owner';
  const canChangeRole = currentAdminIsOwner && !isTargetOwner;
  const canChangePlan = !isTargetOwner;
  
  const effectiveAccess = user ? computeHasFullAccess(
    selectedRole,
    selectedPlan,
    compedAccess
  ) : false;

  const getEffectiveReason = () => {
    if (['owner', 'admin'].includes(selectedRole)) return 'Admin role';
    if (['monthly', 'lifetime'].includes(selectedPlan)) return 'Paid plan';
    if (compedAccess) return 'Comped';
    return null;
  };

  const handleRoleChange = (newRole: string) => {
    if (newRole === 'admin' || selectedRole === 'admin') {
      setPendingRole(newRole);
      setShowRoleConfirm(true);
    } else {
      setSelectedRole(newRole);
    }
  };

  const confirmRoleChange = () => {
    if (pendingRole) {
      setSelectedRole(pendingRole);
    }
    setShowRoleConfirm(false);
    setPendingRole(null);
  };

  const handlePlanChange = (newPlan: string) => {
    if (newPlan === 'lifetime') {
      setShowLifetimeConfirm(true);
    } else {
      setSelectedPlan(newPlan);
      if (newPlan === 'trial') {
        setTrialEndsAt(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
      }
    }
  };

  const confirmLifetimePlan = () => {
    setSelectedPlan('lifetime');
    setShowLifetimeConfirm(false);
  };

  const handleSecurityAction = (action: 'password' | '2fa' | 'email') => {
    setSecurityAction(action);
    setConfirmEmail('');
    setNewAdminEmail('');
    setShowSecurityConfirm(true);
  };

  const executeSecurityAction = async () => {
    if (!user || confirmEmail !== user.email) {
      toast.error('Email does not match');
      return;
    }

    if (securityAction === 'password') {
      setIsResettingPassword(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(user.email!, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success('Password reset email sent');
      } catch (error) {
        logger.error('Error resetting password:', error);
        toast.error('Failed to send password reset email');
      } finally {
        setIsResettingPassword(false);
      }
    } else if (securityAction === '2fa') {
      setIsResetting2FA(true);
      try {
        const { error } = await supabase
          .from('backup_codes')
          .delete()
          .eq('user_id', user.id);
        if (error) throw error;
        toast.success('2FA has been reset');
      } catch (error) {
        logger.error('Error resetting 2FA:', error);
        toast.error('Failed to reset 2FA');
      } finally {
        setIsResetting2FA(false);
      }
    } else if (securityAction === 'email') {
      if (!newAdminEmail || !newAdminEmail.includes('@')) {
        toast.error('Please enter a valid email address');
        return;
      }
      
      setIsUpdatingEmail(true);
      try {
        const { data, error } = await supabase.functions.invoke('admin-update-email', {
          body: { target_user_id: user.id, new_email: newAdminEmail },
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        toast.success(`Email updated to ${newAdminEmail}`);
        onUpdate?.();
      } catch (error: unknown) {
        logger.error('Error updating email:', error);
        toast.error(error.message || 'Failed to update email');
      } finally {
        setIsUpdatingEmail(false);
      }
    }
    
    setShowSecurityConfirm(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      // Update role
      if (selectedRole !== user.role) {
        const { data: existing } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('user_roles')
            .update({ role: selectedRole as 'admin' | 'moderator' | 'owner' | 'user' })
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('user_roles')
            .insert({ user_id: user.id, role: selectedRole as 'admin' | 'moderator' | 'owner' | 'user' });
        }
      }

      // Update profile - explicitly set all comped fields
      const profileUpdate: Record<string, string | boolean | null> = {
        plan_status: selectedPlan,
        trial_ends_at: selectedPlan === 'trial' && trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
        comped_access: compedAccess,
        comped_reason: compedAccess ? (compedReason || 'Manually granted') : null,
      };

      // Always update comped_by and comped_at when enabling comped access
      if (compedAccess) {
        if (!user.comped_access) {
          // First time enabling
          profileUpdate.comped_by = authUser?.id;
          profileUpdate.comped_at = new Date().toISOString();
        }
      } else {
        // Clear comped fields when disabling
        profileUpdate.comped_by = null;
        profileUpdate.comped_at = null;
        profileUpdate.comped_reason = null;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileError) {
        logger.error('Profile update error:', profileError);
        throw profileError;
      }

      // Update feature overrides
      for (const [featureName, enabled] of Object.entries(featureOverrides)) {
        if (enabled === null) {
          // Delete override (inherit from plan)
          const existing = features.find(f => f.feature_name === featureName);
          if (existing) {
            await supabase.from('user_features').delete().eq('id', existing.id);
          }
        } else {
          const existing = features.find(f => f.feature_name === featureName);
          if (existing) {
            await supabase.from('user_features').update({ enabled }).eq('id', existing.id);
          } else {
            await supabase.from('user_features').insert({
              user_id: user.id,
              feature_name: featureName,
              enabled,
              granted_by: authUser?.id,
            });
          }
        }
      }

      toast.success('User updated successfully');
      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      logger.error('Error updating user:', error);
      toast.error('Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  const resetOverrides = () => {
    const reset: Record<string, boolean | null> = {};
    ADVANCED_FEATURES.forEach(f => {
      reset[f.name] = null;
    });
    setFeatureOverrides(reset);
  };

  const getInheritedValue = (featureName: string): boolean => {
    // Features inherited from plan: monthly/lifetime get all, others get none
    return ['monthly', 'lifetime'].includes(selectedPlan) || compedAccess;
  };

  const trialExpired = user?.plan_status === 'trial' && user?.trial_ends_at && isPast(new Date(user.trial_ends_at));

  if (!user) return null;

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Manage User: {user.display_name || user.email}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* E1: Header Summary */}
            <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="text-sm font-medium">
                    {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '-'}
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <RoleBadge role={selectedRole} />
                {selectedRole === 'user' && (
                  <span className="text-xs text-muted-foreground">User</span>
                )}
                <PlanBadge 
                  planStatus={selectedPlan} 
                  compedAccess={compedAccess}
                  earlySupporter={user.early_supporter}
                  showAll
                />
                
                {trialExpired && (
                  <Badge className="text-xs bg-loss/10 text-loss border-loss/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Trial Expired
                  </Badge>
                )}
              </div>
              
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">Effective Access</p>
                <p className={cn(
                  "text-sm font-semibold",
                  effectiveAccess ? 'text-profit' : 'text-muted-foreground'
                )}>
                  {effectiveAccess ? 'FULL' : 'LIMITED'}
                  {getEffectiveReason() && (
                    <span className="font-normal text-muted-foreground ml-2">({getEffectiveReason()})</span>
                  )}
                </p>
              </div>
            </div>

            {/* E2: Permissions (Role) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Permissions (Role)
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Role = admin permissions</TooltipContent>
                </Tooltip>
              </div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select
                      value={selectedRole}
                      onValueChange={handleRoleChange}
                      disabled={!canChangeRole}
                    >
                      <SelectTrigger className="w-full bg-secondary/50 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin" disabled={!currentAdminIsOwner}>Admin</SelectItem>
                        <SelectItem value="owner" disabled>Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                {isTargetOwner && (
                  <TooltipContent>Owner role is protected</TooltipContent>
                )}
                {!currentAdminIsOwner && !isTargetOwner && (
                  <TooltipContent>Only Owner can change Admin roles</TooltipContent>
                )}
              </Tooltip>
            </div>

            {/* E3: Billing / Plan Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Billing / Plan Status
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Plan = paid access</TooltipContent>
                </Tooltip>
              </div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select
                      value={selectedPlan}
                      onValueChange={handlePlanChange}
                      disabled={isTargetOwner}
                    >
                      <SelectTrigger className="w-full bg-secondary/50 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="lifetime">Lifetime</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                {isTargetOwner && <TooltipContent>Cannot change Owner's plan</TooltipContent>}
              </Tooltip>
              
              {selectedPlan === 'trial' && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Trial Ends At</Label>
                  <Input
                    type="date"
                    value={trialEndsAt}
                    onChange={(e) => setTrialEndsAt(e.target.value)}
                    className="bg-secondary/50 border-border/50"
                  />
                </div>
              )}
              
              {['monthly', 'lifetime'].includes(selectedPlan) && (
                <p className="text-xs text-profit">Full access enabled by plan.</p>
              )}
              
              {['free', 'expired'].includes(selectedPlan) && (
                <p className="text-xs text-muted-foreground">Limited access unless overrides/comped enabled.</p>
              )}
            </div>

            {/* E4: Comped Full Access */}
            <div className="space-y-3 p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-purple-400" />
                  <Label className="text-sm font-semibold">Grant Full Access (Comped)</Label>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Comped = full access without billing</TooltipContent>
                </Tooltip>
              </div>
              
              <Switch
                checked={compedAccess}
                onCheckedChange={setCompedAccess}
              />
              
              {compedAccess && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                  <Input
                    placeholder="e.g., Beta tester, Contest winner"
                    value={compedReason}
                    onChange={(e) => setCompedReason(e.target.value)}
                    className="bg-secondary/50 border-border/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Grants full access without billing. Excluded from paid metrics.
                  </p>
                </div>
              )}
              
              <p className="text-xs text-purple-400/70">Comped users are NOT counted as paid.</p>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {/* E5: Advanced Feature Overrides */}
              <AccordionItem value="overrides" className="border-border/50">
                <AccordionTrigger className="text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Advanced Feature Overrides (Beta / Exceptions)
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      {ADVANCED_FEATURES.map(feature => {
                        const override = featureOverrides[feature.name];
                        const inherited = getInheritedValue(feature.name);
                        const isOverridden = override !== null && override !== inherited;
                        
                        return (
                          <div
                            key={feature.name}
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{feature.label}</p>
                                {isOverridden && (
                                  <Badge className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                                    Overridden
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Inherited from plan: {inherited ? 'ON' : 'OFF'}
                              </p>
                            </div>
                            <Switch
                              checked={override ?? inherited}
                              onCheckedChange={(checked) => setFeatureOverrides(prev => ({
                                ...prev,
                                [feature.name]: checked,
                              }))}
                            />
                          </div>
                        );
                      })}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetOverrides}
                        className="w-full mt-2"
                      >
                        Reset overrides to plan defaults
                      </Button>
                      
                      <p className="text-xs text-muted-foreground">
                        Do NOT list core features (dashboard/journal/analytics) here—those come from plan.
                      </p>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* E6: Security Actions */}
              <AccordionItem value="security" className="border-border/50">
                <AccordionTrigger className="text-sm font-semibold text-loss">
                  <span className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Security Actions
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleSecurityAction('password')}
                        disabled={isResettingPassword}
                        className="flex-1 border-border/50 hover:border-loss/50"
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
                        onClick={() => handleSecurityAction('2fa')}
                        disabled={isResetting2FA}
                        className="flex-1 border-border/50 hover:border-loss/50 text-loss hover:text-loss"
                      >
                        {isResetting2FA ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 mr-2" />
                        )}
                        Reset 2FA
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleSecurityAction('email')}
                      disabled={isUpdatingEmail}
                      className="w-full border-border/50 hover:border-primary/50"
                    >
                      {isUpdatingEmail ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Update Email (Admin Override)
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requires email confirmation. Use "Update Email" when user lost access to their old email.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Confirmation */}
      <AlertDialog open={showRoleConfirm} onOpenChange={setShowRoleConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to change {user.email}'s role to <strong>{pendingRole}</strong>. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lifetime Plan Confirmation */}
      <AlertDialog open={showLifetimeConfirm} onOpenChange={setShowLifetimeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Lifetime Access</AlertDialogTitle>
            <AlertDialogDescription>
              Lifetime is permanent access. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLifetimePlan}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Security Action Confirmation */}
      <AlertDialog open={showSecurityConfirm} onOpenChange={setShowSecurityConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {securityAction === 'email' ? 'Update Email Address' : 'Confirm Security Action'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Type the user's current email to confirm: <strong>{user.email}</strong></p>
                <Input
                  placeholder="Type current email to confirm"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                />
                
                {securityAction === 'email' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">New Email Address</label>
                    <Input
                      type="email"
                      placeholder="Enter new email address"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="bg-secondary/50"
                    />
                    <p className="text-xs text-yellow-500 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      This bypasses email confirmation. Only use when user lost access to their old email.
                    </p>
                  </div>
                )}
                
                {securityAction !== 'email' && (
                  <p className="text-sm text-loss">
                    This action will {securityAction === 'password' ? 'send a password reset email' : 'remove all 2FA backup codes'} for this user.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeSecurityAction}
              disabled={confirmEmail !== user.email || (securityAction === 'email' && !newAdminEmail)}
              className={securityAction === 'email' ? 'bg-primary hover:bg-primary/90' : 'bg-loss hover:bg-loss/90'}
            >
              {securityAction === 'email' ? 'Update Email' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};

export default ManageUserModal;
