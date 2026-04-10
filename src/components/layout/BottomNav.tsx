import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Layers, 
  BarChart3, 
  Settings,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserFeatures } from '@/hooks/useUserFeatures';
import { useTradeGroupMutations } from '@/hooks/useTradeGroupMutations';
import { useQueryClient } from '@tanstack/react-query';
import { AddTradeGroupModal } from '@/components/journal/AddTradeGroupModal';
import { haptics } from '@/lib/haptics';

const allNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', feature: null },
  { to: '/journal', icon: Layers, label: 'Portfolio', feature: 'journal' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', feature: 'analytics' },
  { to: '/settings', icon: Settings, label: 'Settings', feature: null },
];

const BottomNav: React.FC = () => {
  const [showAddTrade, setShowAddTrade] = useState(false);
  const { isFeatureEnabled } = useUserFeatures();
  const queryClient = useQueryClient();
  
  // Use lightweight mutations hook - no data fetching, just actions
  const { createGroup } = useTradeGroupMutations(() => {
    // Invalidate relevant queries on mutation success
    queryClient.invalidateQueries({ queryKey: ['journal-data'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
  });

  // Filter nav items based on features
  const navItems = allNavItems.filter(item => 
    item.feature === null || isFeatureEnabled(item.feature)
  );

  // Take only 4 items (2 on each side of the FAB)
  const leftItems = navItems.slice(0, 2);
  const rightItems = navItems.slice(2, 4);

  const handleAddTrade = () => {
    haptics.medium();
    setShowAddTrade(true);
  };

  const handleTradeSubmit = async () => {
    setShowAddTrade(false);
    // Queries are already invalidated via the onSuccess callback
  };

  const handleNavClick = () => {
    haptics.light();
  };

  return (
    <>
      {/* Add Trade Modal */}
      <AddTradeGroupModal
        open={showAddTrade}
        onOpenChange={setShowAddTrade}
        onSubmit={async (data) => {
          const result = await createGroup(data);
          if (!result.error) {
            setShowAddTrade(false);
            // Queries are already invalidated via the createGroup onSuccess callback
          }
          return result;
        }}
      />

      {/* Bottom Navigation */}
      <nav className="lg:hidden bottom-nav" aria-label="Main navigation">
        <div className="grid grid-cols-5 items-center h-[72px] px-3">
          {/* Left side items */}
          {leftItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={handleNavClick}
              className={({ isActive }) =>
                cn(
                  'nav-item min-h-[48px]',
                  isActive ? 'nav-item-active' : 'nav-item-inactive'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn('nav-icon-wrapper p-2', isActive && 'bg-primary/20')}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Center FAB */}
          <div className="flex items-center justify-center">
            <button
              onClick={handleAddTrade}
              aria-label="Add new trade"
              className="w-14 h-14 -mt-7 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform"
              style={{
                boxShadow: '0 4px 20px hsl(var(--primary) / 0.4)',
              }}
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          {/* Right side items */}
          {rightItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              className={({ isActive }) =>
                cn(
                  'nav-item min-h-[48px]',
                  isActive ? 'nav-item-active' : 'nav-item-inactive'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn('nav-icon-wrapper p-2', isActive && 'bg-primary/20')}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
};

export default BottomNav;
