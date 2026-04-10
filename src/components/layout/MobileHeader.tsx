import React, { useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, User, LogOut, Eye, FileStack, Smartphone, Crown, Settings, Shield, Bell, Search, TrendingUp, DollarSign, Bug, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTradeInbox } from '@/hooks/useTradeInbox';
import { useReminders } from '@/hooks/useReminders';
import { useUserFeatures } from '@/hooks/useUserFeatures';
import { useNotificationHistory } from '@/hooks/useNotificationHistory';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { MobileNotificationSheet } from '@/components/notifications/MobileNotificationSheet';
import { haptics } from '@/lib/haptics';

const pageNames: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/journal': 'Portfolio',
  '/analytics': 'Analytics',
  '/watchlist': 'Watchlists',
  '/playbook': 'Playbook',
  '/market': 'Market',
  '/settings': 'Settings',
  '/pricing': 'Pricing',
  '/install': 'Install',
  '/admin': 'Admin',
  '/sales': 'Sales',
  '/trade-inbox': 'Trade Inbox',
  '/settings/notifications': 'Notifications',
  '/settings/billing': 'Billing',
  '/diagnostics': 'Diagnostics',
};

// Menu items with icons and feature flags (matching desktop sidebar)
const menuNavItems = [
  { to: '/watchlist', icon: Eye, label: 'Watchlists', feature: 'watchlist' as const },
  { to: '/playbook', icon: FileStack, label: 'Playbook', feature: 'notes' as const },
  { to: '/market', icon: TrendingUp, label: 'Market', feature: 'market' as const },
  { to: '/install', icon: Smartphone, label: 'Install App', feature: null },
  { to: '/pricing', icon: Crown, label: 'Pricing', feature: null },
  { to: '/settings', icon: Settings, label: 'Settings', feature: null },
];

interface MobileHeaderProps {
  onSearchClick?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ onSearchClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();
  const { counts: inboxCounts } = useTradeInbox();
  const { groupedReminders } = useReminders();
  const { isFeatureEnabled } = useUserFeatures();
  const { unreadCount: unreadAlertsCount } = useNotificationHistory();
  const { updateAvailable, triggerUpdate } = useAppUpdate();
  
  // Calculate combined notification count including unread alerts
  const pendingInboxCount = inboxCounts.pending + inboxCounts.needs_review;
  const pendingTaskCount = groupedReminders.overdue.length + groupedReminders.today.length;
  const totalPendingCount = pendingInboxCount + pendingTaskCount + unreadAlertsCount;
  const [open, setOpen] = React.useState(false);
  const pageName = pageNames[location.pathname] || 'TraderCafé';
  
  // Filter menu items based on user features (matching desktop sidebar behavior)
  const visibleMenuItems = menuNavItems.filter(item => 
    item.feature === null || isFeatureEnabled(item.feature)
  );
  
  // Swipe gesture handling
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const swipeDistance = touchStartX.current - touchEndX.current;
    // Swipe left to close (from right to left gesture)
    if (swipeDistance > 80) {
      haptics.light();
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open && sheetRef.current) {
      const element = sheetRef.current;
      element.addEventListener('touchstart', handleTouchStart, { passive: true });
      element.addEventListener('touchmove', handleTouchMove, { passive: true });
      element.addEventListener('touchend', handleTouchEnd);

      return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [open, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const handleSignOut = async () => {
    haptics.heavy();
    await signOut();
    navigate('/auth');
    setOpen(false);
  };

  const handleNavClick = (to: string) => {
    haptics.medium();
    navigate(to);
    setOpen(false);
  };

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/30">
      {/* Safe area for notch */}
      <div className="safe-area-top" />
      <div className="flex items-center justify-between h-12 px-4">
        {/* Menu Button */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-11 w-11 -ml-2"
              onClick={() => haptics.light()}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          
          <SheetContent 
            side="left" 
            className="w-[280px] bg-card/95 backdrop-blur-xl border-r border-border/50 p-0 pt-[env(safe-area-inset-top)]"
          >
            <div ref={sheetRef} className="h-full">
              <SheetHeader className="p-4 pb-2 text-left">
                <SheetTitle className="text-foreground text-lg font-semibold">Menu</SheetTitle>
                <p className="text-xs text-muted-foreground">Swipe left to close</p>
              </SheetHeader>
              
              <div className="py-2 px-2">
                {/* User Info */}
                <div className="flex items-center gap-3 px-3 py-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {profile?.display_name || 'Trader'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {profile?.email}
                    </p>
                  </div>
                </div>
                
                <Separator className="my-2 bg-border/50" />
                
                {/* Navigation Items */}
                <div className="space-y-1">
                  {visibleMenuItems.map((item) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <Button
                        key={item.to}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start text-foreground h-11 rounded-lg",
                          isActive && "bg-primary/10 text-primary"
                        )}
                        onClick={() => handleNavClick(item.to)}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 mr-3",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )} />
                        {item.label}
                      </Button>
                    );
                  })}
                </div>
                
                {isAdmin && (
                  <>
                    <Separator className="my-2 bg-border/50" />
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-foreground h-11 rounded-lg"
                      onClick={() => handleNavClick('/sales')}
                    >
                      <DollarSign className="h-5 w-5 mr-3 text-muted-foreground" />
                      Sales
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-foreground h-11 rounded-lg"
                      onClick={() => handleNavClick('/admin')}
                    >
                      <Shield className="h-5 w-5 mr-3 text-muted-foreground" />
                      Admin Panel
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-foreground h-11 rounded-lg"
                      onClick={() => handleNavClick('/diagnostics')}
                    >
                      <Bug className="h-5 w-5 mr-3 text-muted-foreground" />
                      Diagnostics
                    </Button>
                  </>
                )}
                
                <Separator className="my-2 bg-border/50" />
                
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:bg-destructive/10 h-11 rounded-lg"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Sign Out
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Page Title */}
        <span className="font-semibold text-foreground text-sm">
          {pageName}
        </span>
        
        {/* Right Actions */}
        <div className="flex items-center gap-1">
          {/* Update Available */}
          {updateAvailable && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-11 w-11 text-primary relative"
              onClick={() => {
                haptics.medium();
                triggerUpdate();
              }}
            >
              <RefreshCw className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
            </Button>
          )}

          {/* Search */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-11 w-11"
            onClick={() => {
              haptics.light();
              onSearchClick?.();
            }}
          >
            <Search className="h-5 w-5" />
          </Button>
          
          {/* Notifications - Full screen sheet on mobile */}
          <MobileNotificationSheet>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-11 w-11 relative"
              onClick={() => haptics.light()}
            >
              <Bell className="h-5 w-5" />
              {totalPendingCount > 0 && (
                <span className="absolute top-0.5 right-0.5 h-5 min-w-5 px-1 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center shadow-lg ring-2 ring-background">
                  {totalPendingCount > 9 ? '9+' : totalPendingCount}
                </span>
              )}
            </Button>
          </MobileNotificationSheet>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
