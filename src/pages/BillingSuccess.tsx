import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const BillingSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const sessionId = searchParams.get('session_id');

  const refreshStatus = useCallback(async () => {
    if (!user) return;

    setIsRefreshing(true);
    try {
      // Call check-subscription to sync latest status from Stripe
      await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      // Reload the page to get fresh profile data
      window.location.reload();
    } catch (error) {
      logger.error('Error refreshing status:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    // Auto-refresh after 3 seconds
    const timer = setTimeout(refreshStatus, 3000);
    return () => clearTimeout(timer);
  }, [refreshStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-profit/10">
            <CheckCircle className="h-12 w-12 text-profit" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Payment Successful! ☕</h1>
          <p className="text-muted-foreground">
            Your account will update in a few seconds.
          </p>
        </div>

        {profile?.plan_status && (
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">
              Current status: <span className="font-medium text-foreground capitalize">{profile.plan_status}</span>
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Button 
            onClick={() => navigate('/dashboard')} 
            className="w-full"
          >
            Go to Dashboard
          </Button>
          
          <Button 
            variant="outline" 
            onClick={refreshStatus}
            disabled={isRefreshing}
            className="w-full"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh Status
          </Button>
        </div>

        {sessionId && (
          <p className="text-xs text-muted-foreground">
            Session: {sessionId.slice(0, 20)}...
          </p>
        )}
      </Card>
    </div>
  );
};

export default BillingSuccess;
