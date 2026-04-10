import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, Search, Loader2, AlertTriangle, Gift, Crown, Settings2, Star } from 'lucide-react';
import { format, isPast, addHours } from 'date-fns';
import { cn } from '@/lib/utils';
import { ManageUserModal } from './ManageUserModal';
import { PlanBadge, RoleBadge } from '@/components/common/PlanBadge';

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

interface UserManagementTabProps {
  users: ExtendedProfile[];
  isLoading: boolean;
  onRefresh: () => void;
  paidUsersCount: number;
  compedUsersCount: number;
  currentAdminIsOwner: boolean;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({
  users,
  isLoading,
  onRefresh,
  paidUsersCount,
  compedUsersCount,
  currentAdminIsOwner,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [showCompedOnly, setShowCompedOnly] = useState(false);
  const [showTrialsExpiringSoon, setShowTrialsExpiringSoon] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<ExtendedProfile | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search filter
      const matchesSearch = !searchQuery || 
        u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Role filter
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      
      // Plan filter
      const matchesPlan = planFilter === 'all' || u.plan_status === planFilter;
      
      // Comped filter
      const matchesComped = !showCompedOnly || u.comped_access;
      
      // Trials expiring soon (within 48h)
      const matchesTrialExpiring = !showTrialsExpiringSoon || (
        u.plan_status === 'trial' && 
        u.trial_ends_at && 
        !isPast(new Date(u.trial_ends_at)) &&
        new Date(u.trial_ends_at) <= addHours(new Date(), 48)
      );
      
      return matchesSearch && matchesRole && matchesPlan && matchesComped && matchesTrialExpiring;
    });
  }, [users, searchQuery, roleFilter, planFilter, showCompedOnly, showTrialsExpiringSoon]);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      case 'admin': return 'bg-profit/10 text-profit border-profit/30';
      case 'moderator': return 'bg-primary/10 text-primary border-primary/30';
      default: return 'bg-secondary text-muted-foreground';
    }
  };

  const getPlanBadgeStyle = (plan: string) => {
    switch (plan) {
      case 'lifetime': return 'bg-primary/10 text-primary border-primary/30';
      case 'monthly': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'trial': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      case 'expired': return 'bg-loss/10 text-loss border-loss/30';
      default: return 'bg-secondary text-muted-foreground';
    }
  };

  const handleManageUser = (user: ExtendedProfile) => {
    setSelectedUser(user);
    setShowManageModal(true);
  };

  const handleModalClose = (open: boolean) => {
    setShowManageModal(open);
    if (!open) {
      setSelectedUser(null);
      onRefresh();
    }
  };

  return (
    <TooltipProvider>
      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5" />
            All Users ({filteredUsers.length})
          </h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Paid: <strong className="text-profit">{paidUsersCount}</strong></span>
            <span>Comped: <strong className="text-purple-400">{compedUsersCount}</strong></span>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-4 mb-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or display name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/50 border-border/50"
            />
          </div>
          
          {/* Filter dropdowns and toggles */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Role:</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[120px] h-8 bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Plan:</Label>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[120px] h-8 bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="comped-only"
                checked={showCompedOnly}
                onCheckedChange={setShowCompedOnly}
              />
              <Label htmlFor="comped-only" className="text-xs cursor-pointer">Comped only</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="trials-expiring"
                checked={showTrialsExpiringSoon}
                onCheckedChange={setShowTrialsExpiringSoon}
              />
              <Label htmlFor="trials-expiring" className="text-xs cursor-pointer">Trials expiring soon</Label>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase w-[200px]">Email</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase w-[120px]">Name</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase w-[80px]">Role</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase w-[100px]">Plan</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase w-[90px]">Trial</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase w-[80px]">Status</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase w-[80px]">Joined</th>
                  <th className="text-center py-3 px-3 text-xs font-semibold text-muted-foreground uppercase sticky right-0 bg-card z-10 w-[100px] shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.2)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => {
                  const trialExpired = user.plan_status === 'trial' && user.trial_ends_at && isPast(new Date(user.trial_ends_at));
                  
                  return (
                    <tr key={user.id} className="border-b border-border/30 hover:bg-secondary/30">
                      <td className="py-2 px-3 text-sm text-muted-foreground truncate max-w-[200px]" title={user.email || ''}>
                        {user.email}
                      </td>
                      <td className="py-2 px-3 text-sm font-medium text-foreground truncate max-w-[120px]" title={user.display_name || ''}>
                        {user.display_name || 'No name'}
                      </td>
                      <td className="py-2 px-3">
                        <RoleBadge role={user.role} />
                        {!user.role || user.role === 'user' ? (
                          <span className="text-xs text-muted-foreground">User</span>
                        ) : null}
                      </td>
                      <td className="py-2 px-3">
                        <PlanBadge 
                          planStatus={user.plan_status} 
                          compedAccess={user.comped_access}
                          earlySupporter={user.early_supporter}
                          showAll
                        />
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {user.plan_status === 'trial' && user.trial_ends_at ? (
                          <span className={cn(trialExpired && 'text-loss')}>
                            {format(new Date(user.trial_ends_at), 'M/d')}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {trialExpired && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="text-xs bg-loss/10 text-loss border-loss/30 cursor-help px-1.5">
                                  <AlertTriangle className="h-3 w-3" />
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>Trial expired—should be Free</TooltipContent>
                            </Tooltip>
                          )}
                          {!trialExpired && !user.comped_access && !user.early_supporter && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {user.created_at ? format(new Date(user.created_at), 'M/d') : '-'}
                      </td>
                      <td className="py-2 px-3 sticky right-0 bg-card z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.2)]">
                        <div className="flex items-center justify-center">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 btn-glass border-border/50 text-xs px-2"
                            onClick={() => handleManageUser(user)}
                          >
                            <Settings2 className="h-3 w-3 mr-1" />
                            Manage
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No users found matching filters
              </div>
            )}
          </div>
        )}
      </div>

      <ManageUserModal
        user={selectedUser}
        currentAdminIsOwner={currentAdminIsOwner}
        open={showManageModal}
        onOpenChange={handleModalClose}
        onUpdate={onRefresh}
      />
    </TooltipProvider>
  );
};

export default UserManagementTab;
