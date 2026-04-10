import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function OfflineBanner() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-yellow-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You're offline. Some features may be unavailable.</span>
    </div>
  );
}
