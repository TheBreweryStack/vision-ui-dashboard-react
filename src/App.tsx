import { Suspense, lazy, useEffect, useRef, useCallback, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppUpdateProvider, useAppUpdate } from "@/hooks/useAppUpdate";
import MainLayout from "@/components/layout/MainLayout";
import AuthTransitionScreen from "@/components/auth/AuthTransitionScreen";
import AppStartupScreen from "@/components/common/AppStartupScreen";
import { JournalSkeleton } from "@/components/skeletons/JournalSkeleton";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { PageSkeleton } from "@/components/skeletons/PageSkeleton";
import { RequireAdmin } from "@/components/auth/RequireAdmin";
import { startServiceWorkerHealthMonitor } from "@/lib/pushNotifications";
import { usePushNotificationToast } from "@/hooks/usePushNotificationToast";
import { FirstTimeNotificationPrompt } from "@/components/notifications/FirstTimeNotificationPrompt";
import { checkForUpdates, clearCachesAndReload } from "@/lib/buildInfo";
import { logger } from '@/lib/logger';

// Lazy load pages for code splitting
const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Journal = lazy(() => import("@/pages/Journal"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Settings = lazy(() => import("@/pages/Settings"));
const Playbook = lazy(() => import("@/pages/Playbook"));
const Alerts = lazy(() => import("@/pages/Alerts"));
const Watchlist = lazy(() => import("@/pages/Watchlist"));
const Admin = lazy(() => import("@/pages/Admin"));
const Sales = lazy(() => import("@/pages/Sales"));
const Market = lazy(() => import("@/pages/Market"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Billing = lazy(() => import("@/pages/Billing"));
const BillingSuccess = lazy(() => import("@/pages/BillingSuccess"));
const Install = lazy(() => import("@/pages/Install"));
const Terms = lazy(() => import("@/pages/Terms"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const RiskDisclosure = lazy(() => import("@/pages/RiskDisclosure"));
const CookiePolicy = lazy(() => import("@/pages/CookiePolicy"));
const NotificationSettings = lazy(() => import("@/pages/NotificationSettings"));
const TradeInbox = lazy(() => import("@/pages/TradeInbox"));

const Diagnostics = lazy(() => import("@/pages/Diagnostics"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Configure React Query with optimized defaults (Phase 3 rebuild)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds - data stays fresh
      gcTime: 300000, // 5 minutes - cache retention
      refetchOnWindowFocus: false, // Don't refetch when tab regains focus
      retry: 1, // Only retry once on failure
    },
  },
});

// Wrapper component to show transition screen during auth changes
const AppContent = () => {
  const { authTransition, profile, user } = useAuth();
  const { setUpdateAvailable } = useAppUpdate();
  const updateCheckRef = useRef<NodeJS.Timeout | null>(null);
  const [isStartupComplete, setIsStartupComplete] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Listen for push notifications forwarded from Service Worker
  usePushNotificationToast();
  
  // Handle update prompt (for background checks while app is open)
  const promptForUpdate = useCallback(() => {
    setUpdateAvailable(true);
    toast('New version available', {
      id: 'app-update',
      description: 'A newer version of the app is ready.',
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: () => window.location.reload(),
      },
    });
  }, [setUpdateAvailable]);
  
  // Startup check - runs once when app opens
  useEffect(() => {
    const checkStartup = async () => {
      logger.log('[Build] Startup check...');
      const hasUpdate = await checkForUpdates();
      if (hasUpdate) {
        logger.log('[Build] New version found on startup, updating...');
        setIsUpdating(true);
        await clearCachesAndReload();
        return; // Page will reload
      }
      logger.log('[Build] App is up to date');
      setIsStartupComplete(true);
    };
    
    checkStartup();
  }, []);
  
  // Check for updates when app resumes from background (mobile PWA)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) return;
      
      logger.log('[Build] App resumed, checking for updates...');
      const hasUpdate = await checkForUpdates();
      if (hasUpdate) {
        logger.log('[Build] New version found on resume, updating...');
        setIsStartupComplete(false);
        setIsUpdating(true);
        await clearCachesAndReload();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  
  // Check for updates periodically (every 5 minutes) while app is open
  useEffect(() => {
    const checkInterval = 5 * 60 * 1000; // 5 minutes
    
    const runCheck = async () => {
      const hasUpdate = await checkForUpdates();
      if (hasUpdate) {
        logger.log('[Build] New version available');
        promptForUpdate();
      }
    };
    
    updateCheckRef.current = setInterval(runCheck, checkInterval);
    
    return () => {
      if (updateCheckRef.current) {
        clearInterval(updateCheckRef.current);
      }
    };
  }, [promptForUpdate]);
  
  // Start Service Worker health monitoring when user is authenticated
  useEffect(() => {
    if (!user) return;
    
    const cleanup = startServiceWorkerHealthMonitor(
      () => {}, // Silent on healthy
      () => logger.warn('[App] Service Worker unhealthy, recovery in progress...')
    );
    
    return cleanup;
  }, [user]);
  
  // Show startup loading screen until check completes
  if (!isStartupComplete) {
    return <AppStartupScreen isUpdating={isUpdating} />;
  }

  return (
    <>
      {authTransition && <AuthTransitionScreen type={authTransition} displayName={profile?.display_name} />}
      {user && <FirstTimeNotificationPrompt />}
      <Routes>
        <Route path="/auth" element={<Suspense fallback={<PageSkeleton />}><Auth /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<PageSkeleton />}><ResetPassword /></Suspense>} />
        <Route path="/install" element={<Suspense fallback={<PageSkeleton />}><Install /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<PageSkeleton />}><Terms /></Suspense>} />
        <Route path="/privacy" element={<Suspense fallback={<PageSkeleton />}><Privacy /></Suspense>} />
        <Route path="/risk-disclosure" element={<Suspense fallback={<PageSkeleton />}><RiskDisclosure /></Suspense>} />
        <Route path="/cookie-policy" element={<Suspense fallback={<PageSkeleton />}><CookiePolicy /></Suspense>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Suspense fallback={<DashboardSkeleton />}><Dashboard /></Suspense>} />
          <Route path="/journal" element={<Suspense fallback={<JournalSkeleton />}><Journal /></Suspense>} />
          <Route path="/analytics" element={<Suspense fallback={<PageSkeleton />}><Analytics /></Suspense>} />
          <Route path="/playbook" element={<Suspense fallback={<PageSkeleton />}><Playbook /></Suspense>} />
          <Route path="/alerts" element={<Suspense fallback={<PageSkeleton />}><Alerts /></Suspense>} />
          <Route path="/watchlist" element={<Suspense fallback={<PageSkeleton />}><Watchlist /></Suspense>} />
          <Route path="/market" element={<Suspense fallback={<PageSkeleton />}><Market /></Suspense>} />
          <Route path="/pricing" element={<Suspense fallback={<PageSkeleton />}><Pricing /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageSkeleton />}><Settings /></Suspense>} />
          <Route path="/settings/notifications" element={<Suspense fallback={<PageSkeleton />}><NotificationSettings /></Suspense>} />
          <Route path="/settings/billing" element={<Suspense fallback={<PageSkeleton />}><Billing /></Suspense>} />
          <Route path="/trade-inbox" element={<Suspense fallback={<PageSkeleton />}><TradeInbox /></Suspense>} />
          <Route path="/notifications" element={<Navigate to="/settings/notifications" replace />} />
          <Route path="/admin" element={<RequireAdmin><Suspense fallback={<PageSkeleton />}><Admin /></Suspense></RequireAdmin>} />
          <Route path="/sales" element={<RequireAdmin><Suspense fallback={<PageSkeleton />}><Sales /></Suspense></RequireAdmin>} />
          <Route path="/diagnostics" element={<RequireAdmin><Suspense fallback={<PageSkeleton />}><Diagnostics /></Suspense></RequireAdmin>} />
        </Route>
        <Route path="/billing/success" element={<Suspense fallback={<PageSkeleton />}><BillingSuccess /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<PageSkeleton />}><NotFound /></Suspense>} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AppUpdateProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </AppUpdateProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
