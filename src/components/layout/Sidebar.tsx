import React, { useState, useRef, useEffect, memo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserFeatures } from '@/hooks/useUserFeatures';
import { useTradeInbox } from '@/hooks/useTradeInbox';
import { useReminders } from '@/hooks/useReminders';
import { useNotificationHistory } from '@/hooks/useNotificationHistory';
import { useAccessControl } from '@/hooks/useAccessControl';
import { usePortfolios } from '@/hooks/usePortfolios';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Layers,
  BarChart3,
  Eye,
  Bell,
  Settings,
  Shield,
  LogOut,
  Globe,
  Crown,
  Search,
  HelpCircle,
  Mail,
  DollarSign,
  FileStack,
  Bug,
  Sparkles,
  ChevronDown,
  Check,
  Plus,
  Pencil,
  Trash2,
  EyeOff,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import logoImage from '@/assets/logo.png';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { ContactUsDialog } from '@/components/common/ContactUsDialog';
import { LiveSearchResults } from '@/components/search/LiveSearchResults';
import { CreatePortfolioModal } from '@/components/journal/CreatePortfolioModal';
import { toast } from 'sonner';

// Map nav items to their feature names (Portfolio handled separately)
const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', feature: 'dashboard' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', feature: 'analytics' },
  { to: '/watchlist', icon: Eye, label: 'Watchlists', feature: 'watchlist' },
  { to: '/playbook', icon: FileStack, label: 'Playbook', feature: 'notes' },
  { to: '/market', icon: Globe, label: 'Market', feature: 'market' },
  { to: '/pricing', icon: Crown, label: 'Pricing', feature: null },
];

const SidebarComponent: React.FC = () => {
  const { profile, isAdmin, signOut, isRoleLoading } = useAuth();
  const { isFeatureEnabled } = useUserFeatures();
  const { counts: inboxCounts } = useTradeInbox();
  const { groupedReminders } = useReminders();
  const { unreadCount: unreadAlertsCount } = useNotificationHistory();
  const { hasFullAccess, displayPlanName, isFree, isLoading: accessLoading } = useAccessControl();
  const { portfolios, archivedPortfolios, activePortfolioId, switchPortfolio, renamePortfolio, deletePortfolio, archivePortfolio, unarchivePortfolio } = usePortfolios();
  const navigate = useNavigate();
  const location = useLocation();
  const [contactUsOpen, setContactUsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const showPlanUI = !isRoleLoading && !accessLoading;
  const isJournalActive = location.pathname === '/journal';

  const pendingInboxCount = (inboxCounts?.pending || 0) + (inboxCounts?.needs_review || 0) + (inboxCounts?.action_required || 0);
  const pendingTasksCount = groupedReminders?.triggered?.length || 0;
  const totalPendingCount = pendingInboxCount + pendingTasksCount + unreadAlertsCount;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSelect = (path: string) => {
    setShowSearchResults(false);
    setSearchQuery('');
    navigate(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getUserInitials = () => {
    if (profile?.display_name) {
      return profile.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return profile?.email?.[0]?.toUpperCase() || 'U';
  };

  const visibleNavItems = navItems.filter(item => {
    if (!item.feature) return true;
    return isFeatureEnabled(item.feature);
  });

  const showPortfolioNav = isFeatureEnabled('journal');

  // Split nav items: Dashboard first, then Portfolio, then rest
  const dashboardItem = visibleNavItems.find(i => i.to === '/dashboard');
  const restItems = visibleNavItems.filter(i => i.to !== '/dashboard');

  const handlePortfolioClick = (portfolioId: string) => {
    switchPortfolio(portfolioId);
    navigate('/journal');
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      await renamePortfolio(id, renameValue.trim());
      toast.success('Portfolio renamed');
      setRenamingId(null);
    } catch {
      toast.error('Failed to rename');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePortfolio(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleArchive = async (id: string, name: string) => {
    try {
      await archivePortfolio(id);
      toast.success(`"${name}" hidden`);
    } catch {
      toast.error('Failed to hide');
    }
  };

  const handleUnarchive = async (id: string, name: string) => {
    try {
      await unarchivePortfolio(id);
      toast.success(`"${name}" restored`);
    } catch {
      toast.error('Failed to restore');
    }
  };

  return (
    <>
      <aside className="lg:flex flex-col w-64 h-full bg-sidebar/50 backdrop-blur-xl border-r border-sidebar-border/50 absolute inset-0">
        {/* Logo */}
        <div className="flex items-center gap-3 p-6">
          <img 
            src={logoImage} 
            alt="TraderCafé" 
            className="w-12 h-12 rounded-xl object-contain"
          />
          <div>
            <span className="text-xl font-semibold text-sidebar-foreground">TraderCafé</span>
            <p className="text-xs text-muted-foreground">Trading Journal</p>
          </div>
        </div>
        
        <Separator className="bg-sidebar-border/50" />
        
        {/* Inline Search Bar */}
        <div className="px-3 py-3" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search trades, notes..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length >= 2) {
                  setShowSearchResults(true);
                }
              }}
              onFocus={() => {
                if (searchQuery.length >= 2) {
                  setShowSearchResults(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowSearchResults(false);
                  setSearchQuery('');
                }
              }}
              className="pl-9 pr-4 w-full bg-accent/50 border-0 rounded-xl text-sm"
            />
            {showSearchResults && searchQuery.length >= 2 && (
              <LiveSearchResults
                query={searchQuery}
                onSelect={handleSearchSelect}
                onClose={() => setShowSearchResults(false)}
              />
            )}
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {/* Dashboard */}
          {dashboardItem && (
            <NavLink
              to={dashboardItem.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )
              }
            >
              <dashboardItem.icon className="h-5 w-5" />
              <span>{dashboardItem.label}</span>
            </NavLink>
          )}

          {/* Portfolio - Collapsible with sub-menu */}
          {showPortfolioNav && (
            <Collapsible open={portfolioOpen} onOpenChange={setPortfolioOpen}>
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 w-full text-left',
                    isJournalActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                  onClick={(e) => {
                    // Navigate to journal on click, toggle on chevron
                    if (!(e.target as HTMLElement).closest('[data-chevron]')) {
                      navigate('/journal');
                    }
                  }}
                >
                  <Layers className="h-5 w-5" />
                  <span className="flex-1">Portfolio</span>
                  <ChevronDown
                    data-chevron
                    className={cn(
                      'h-4 w-4 transition-transform duration-200',
                      portfolioOpen && 'rotate-180'
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-4 mt-1 space-y-0.5">
                {portfolios.map((portfolio) => {
                  if (renamingId === portfolio.id) {
                    return (
                      <div key={portfolio.id} className="flex items-center gap-1.5 px-2 py-1">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(portfolio.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                        />
                        <Button size="sm" className="h-7 px-2 text-[10px]" onClick={() => handleRename(portfolio.id)}>Save</Button>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={portfolio.id}
                      className={cn(
                        'flex items-center gap-2.5 px-4 py-2 rounded-lg text-sm w-full text-left transition-all duration-150 group cursor-pointer',
                        portfolio.id === activePortfolioId
                          ? 'text-primary bg-primary/5'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                      )}
                      onClick={() => handlePortfolioClick(portfolio.id)}
                    >
                      <span className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0',
                        portfolio.id === activePortfolioId ? 'bg-primary' : 'bg-muted-foreground/40'
                      )} />
                      <span className="flex-1 truncate">{portfolio.name}</span>
                      {portfolio.id === activePortfolioId && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0 group-hover:hidden" />
                      )}
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="p-1 rounded hover:bg-accent"
                          onClick={() => { setRenameValue(portfolio.name); setRenamingId(portfolio.id); }}
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {!portfolio.is_default && (
                          <>
                            <button
                              className="p-1 rounded hover:bg-accent"
                              onClick={() => handleArchive(portfolio.id, portfolio.name)}
                              title="Hide"
                            >
                              <EyeOff className="h-3 w-3" />
                            </button>
                            <button
                              className="p-1 rounded hover:bg-destructive/20"
                              onClick={() => setDeleteTarget({ id: portfolio.id, name: portfolio.name })}
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Archived portfolios */}
                {archivedPortfolios.length > 0 && (
                  <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground w-full text-left transition-colors">
                        <EyeOff className="h-3 w-3" />
                        <span className="flex-1">Hidden ({archivedPortfolios.length})</span>
                        <ChevronDown className={cn('h-3 w-3 transition-transform', archivedOpen && 'rotate-180')} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-0.5">
                      {archivedPortfolios.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2.5 px-4 py-1.5 rounded-lg text-xs text-muted-foreground/60 w-full"
                        >
                          <span className="flex-1 truncate">{p.name}</span>
                          <button
                            className="p-1 rounded hover:bg-accent"
                            onClick={() => handleUnarchive(p.id, p.name)}
                            title="Restore"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 w-full text-left transition-all duration-150"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Portfolio</span>
                </button>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Rest of nav items */}
          {restItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
              {item.to === '/pricing' && showPlanUI && isFree && (
                <Badge className="ml-auto bg-primary/20 text-primary text-[10px] px-1.5">
                  Upgrade
                </Badge>
              )}
            </NavLink>
          ))}
          
          {isAdmin && (
            <>
              <Separator className="my-3 bg-sidebar-border/50" />
              <NavLink
                to="/sales"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )
                }
              >
                <DollarSign className="h-5 w-5" />
                <span>Sales</span>
              </NavLink>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )
                }
              >
                <Shield className="h-5 w-5" />
                <span>Admin</span>
              </NavLink>
              <NavLink
                to="/diagnostics"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )
                }
              >
                <Bug className="h-5 w-5" />
                <span>Diagnostics</span>
              </NavLink>
            </>
          )}
        </nav>
        
        {/* Trial CTA Widget */}
        {showPlanUI && isFree && (
          <div className="p-3 pb-0">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Try Premium Free</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    7-day trial, no credit card required
                  </p>
                  <NavLink 
                    to="/pricing"
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    Start Free Trial
                  </NavLink>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help & Support Section */}
        <div className="p-3">
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <HelpCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Need help?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Having issues or have a product idea
                </p>
                <button 
                  onClick={() => setContactUsOpen(true)}
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Contact Us
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* User Section */}
        <div className="p-4 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-accent/30">
            <Avatar className="h-9 w-9 border border-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || 'User'} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.display_name || 'Trader'}
              </p>
              {showPlanUI && (
                <div className="flex items-center gap-1.5">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[9px] px-1.5 py-0 h-4",
                      isFree 
                        ? "border-muted-foreground/30 text-muted-foreground" 
                        : "border-primary/30 text-primary"
                    )}
                  >
                    {displayPlanName}
                  </Badge>
                </div>
              )}
            </div>

            <NavLink to="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Settings className="h-4 w-4" />
              </Button>
            </NavLink>

            <NotificationDropdown side="right" align="end" sideOffset={12} alignOffset={-8}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
              >
                <Bell className="h-4 w-4" />
                {totalPendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-loss text-[10px] font-bold text-white flex items-center justify-center">
                    {totalPendingCount > 99 ? '99+' : totalPendingCount}
                  </span>
                )}
              </Button>
            </NotificationDropdown>
          </div>
          
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-10 mt-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
          
          {isAdmin && (
            <p className="text-[10px] text-muted-foreground/50 mt-3 text-center font-mono">
              Build: {new Date().toISOString().slice(0, 16)}
            </p>
          )}
        </div>
      </aside>

      <ContactUsDialog 
        open={contactUsOpen} 
        onOpenChange={setContactUsOpen} 
      />

      <CreatePortfolioModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Portfolio</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? Trades assigned to it will become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const Sidebar = memo(SidebarComponent);

export default Sidebar;
