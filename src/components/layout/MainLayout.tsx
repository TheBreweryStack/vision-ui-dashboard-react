import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import MobileHeader from './MobileHeader';
import WebFAB from './WebFAB';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { InstallPromptBanner } from '@/components/common/InstallPromptBanner';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import { useRealtimeNotificationEffects } from '@/hooks/useRealtimeNotificationEffects';
import { useLocalAlerts } from '@/hooks/useLocalAlerts';
import { haptics } from '@/lib/haptics';

const MainLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const edgeSwipeStart = useRef(false);
  const edgeSwipeStartX = useRef(0);

  // Subscribe to realtime notifications (sound + vibration)
  useRealtimeNotificationEffects();

  // Local alerts for due reminders (polls every 30s when app is open)
  useLocalAlerts();

  // Edge swipe gesture to open menu (mobile only)
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      // Started from left edge (within 20px)
      if (touch.clientX < 20) {
        edgeSwipeStart.current = true;
        edgeSwipeStartX.current = touch.clientX;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (edgeSwipeStart.current) {
        const touch = e.changedTouches[0];
        const swipeDistance = touch.clientX - edgeSwipeStartX.current;
        // Swiped from edge to middle (> 100px) - trigger menu open
        if (swipeDistance > 100) {
          haptics.light();
          // Dispatch custom event that MobileHeader can listen to
          window.dispatchEvent(new CustomEvent('open-mobile-menu'));
        }
        edgeSwipeStart.current = false;
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="h-screen bg-background overflow-hidden flex">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-4 focus:left-4 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Offline status banner */}
      <OfflineBanner />

      {/* Global Search Command Palette - for keyboard shortcut Cmd+K */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      
      {/* Desktop Sidebar - wrapper with fixed width for stable layout */}
      <div className="hidden lg:block w-64 h-full flex-shrink-0 relative">
        <Sidebar />
      </div>
      
      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <MobileHeader onSearchClick={() => setSearchOpen(true)} />
        
        {/* Main Content - proper mobile bottom padding for FAB + bottom nav */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto pt-[calc(48px+env(safe-area-inset-top))] lg:pt-0 pb-28 lg:pb-0 focus:outline-none"
          tabIndex={-1}
        >
          <div className="p-4 lg:p-6 max-w-7xl mx-auto">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
        
        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>
      
      {/* Desktop Floating Action Button */}
      <WebFAB />
      
      {/* PWA Install Prompt Banner - Mobile only */}
      <InstallPromptBanner />
    </div>
  );
};

export default MainLayout;
