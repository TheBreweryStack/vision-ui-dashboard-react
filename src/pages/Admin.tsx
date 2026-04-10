import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ShieldCheck, Megaphone, 
  Loader2, Settings,
  RefreshCw, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { AdminStatsCards } from '@/components/admin/AdminStatsCards';
import { AllTradesTab } from '@/components/admin/AllTradesTab';
import { AppSettingsModal } from '@/components/admin/AppSettingsModal';
import { AnnouncementsTab } from '@/components/admin/AnnouncementsTab';
import MarketDataTestPanel from '@/components/admin/MarketDataTestPanel';
import AICoachDevPanel from '@/components/admin/AICoachDevPanel';
import UserManagementTab from '@/components/admin/UserManagementTab';

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

interface AdminStats {
  totalUsers: number;
  totalTrades: number;
  platformPnl: number;
  winRate: number;
  activeToday: number;
  openPositions: number;
  paidUsers: number;
  compedUsers: number;
  trialUsers: number;
  churnedUsers: number;
}

const Admin: React.FC = () => {
  const { isAdmin, userRole, isLoading: authLoading } = useAuth();
  
  const [users, setUsers] = useState<ExtendedProfile[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalTrades: 0,
    platformPnl: 0,
    winRate: 0,
    activeToday: 0,
    openPositions: 0,
    paidUsers: 0,
    compedUsers: 0,
    trialUsers: 0,
    churnedUsers: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals
  const [showAppSettingsModal, setShowAppSettingsModal] = useState(false);
  
  const currentAdminIsOwner = userRole?.role === 'owner';

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles with new columns
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      
      if (rolesError) throw rolesError;

      // Merge profiles with roles
      const usersWithRoles: ExtendedProfile[] = (profiles || []).map(profile => ({
        ...profile,
        plan_status: profile.plan_status || 'free',
        comped_access: profile.comped_access || false,
        early_supporter: profile.early_supporter || false,
        role: roles?.find(r => r.user_id === profile.id)?.role || 'user',
      }));

      setUsers(usersWithRoles);

      // Calculate user counts by status
      const paidUsers = usersWithRoles.filter(u => 
        ['monthly', 'lifetime'].includes(u.plan_status) && !u.comped_access
      ).length;
      const compedUsers = usersWithRoles.filter(u => u.comped_access).length;
      const trialUsers = usersWithRoles.filter(u => u.plan_status === 'trial').length;
      const churnedUsers = usersWithRoles.filter(u => 
        u.plan_status === 'expired' || u.plan_status === 'free'
      ).length;

      // Fetch stats
      const { data: tradesData, error: tradesError } = await supabase
        .from('trades')
        .select('*');
      
      if (tradesError) throw tradesError;

      const trades = tradesData || [];
      const closedTrades = trades.filter(t => t.status === 'closed');
      const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
      const openTrades = trades.filter(t => t.status === 'open');
      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

      setStats({
        totalUsers: usersWithRoles.length,
        totalTrades: trades.length,
        platformPnl: totalPnl,
        winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
        activeToday: 0,
        openPositions: openTrades.length,
        paidUsers,
        compedUsers,
        trialUsers,
        churnedUsers,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  // Redirect non-admins
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6 animate-in">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="icon-box-primary">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-title">Admin Dashboard</h1>
            <p className="page-subtitle">Manage users, view all trades, and monitor system analytics.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowAppSettingsModal(true)}
            className="btn-glass border-border/50"
          >
            <Settings className="h-4 w-4 mr-2" />
            App Settings
          </Button>
          <Button 
            variant="outline" 
            onClick={fetchData}
            className="btn-glass border-border/50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <AdminStatsCards stats={stats} isLoading={isLoading} />

      {/* Tabs */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="tabs-glass mb-6 w-auto flex-wrap">
          <TabsTrigger value="users" className="flex items-center gap-2 px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg">
            User Management
          </TabsTrigger>
          <TabsTrigger value="trades" className="flex items-center gap-2 px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg">
            All Trades
          </TabsTrigger>
          <TabsTrigger value="announcements" className="flex items-center gap-2 px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg">
            <Megaphone className="h-4 w-4" />
            Announcements
          </TabsTrigger>
          <TabsTrigger value="market-data" className="flex items-center gap-2 px-4 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg">
            <Activity className="h-4 w-4" />
            Market Data
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <UserManagementTab
            users={users}
            isLoading={isLoading}
            onRefresh={fetchData}
            paidUsersCount={stats.paidUsers}
            compedUsersCount={stats.compedUsers}
            currentAdminIsOwner={currentAdminIsOwner}
          />
        </TabsContent>

        {/* All Trades Tab */}
        <TabsContent value="trades">
          <AllTradesTab />
        </TabsContent>

        {/* Announcements Tab */}
        <TabsContent value="announcements">
          <AnnouncementsTab />
        </TabsContent>

        {/* Market Data Test Panel */}
        <TabsContent value="market-data">
          <div className="content-card space-y-8">
            <MarketDataTestPanel />
            <AICoachDevPanel />
          </div>
        </TabsContent>
      </Tabs>

      {/* App Settings Modal */}
      <AppSettingsModal
        open={showAppSettingsModal}
        onOpenChange={setShowAppSettingsModal}
      />
    </div>
  );
};

export default Admin;
