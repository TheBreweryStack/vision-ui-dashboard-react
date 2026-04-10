import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Send } from 'lucide-react';
import { PushDebugPanel } from '@/components/diagnostics/PushDebugPanel';

const BUILD_ID = new Date().toISOString();

const Diagnostics: React.FC = () => {
  const { user, session, profile, userRole, isAdmin, isLoading } = useAuth();
  const [testResults, setTestResults] = useState<Record<string, { status: 'idle' | 'loading' | 'success' | 'error'; message: string }>>({
    'stripe-sales': { status: 'idle', message: '' },
    'contact-support': { status: 'idle', message: '' },
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const testEdgeFunction = async (functionName: string) => {
    setTestResults(prev => ({ ...prev, [functionName]: { status: 'loading', message: 'Testing...' } }));
    try {
      const body = functionName === 'contact-support'
        ? { subject: 'Test', body: 'Diagnostics test', requestType: 'technical' }
        : { rangeDays: 30, limit: 5 };
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) {
        setTestResults(prev => ({ ...prev, [functionName]: { status: 'error', message: error.message || JSON.stringify(error) } }));
      } else {
        setTestResults(prev => ({ ...prev, [functionName]: { status: 'success', message: JSON.stringify(data).slice(0, 200) + (JSON.stringify(data).length > 200 ? '...' : '') } }));
      }
    } catch (err: unknown) {
      setTestResults(prev => ({ ...prev, [functionName]: { status: 'error', message: err instanceof Error ? err.message : String(err) } }));
    }
  };

  const StatusIcon = ({ status }: { status: 'idle' | 'loading' | 'success' | 'error' }) => {
    if (status === 'loading') return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    if (status === 'success') return <CheckCircle2 className="h-4 w-4 text-profit" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-loss" />;
    return null;
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">App Diagnostics</h1>
        <Badge variant="outline" className="font-mono text-xs">Build: {BUILD_ID.slice(0, 19)}</Badge>
      </div>

      {/* Environment Info */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Environment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">Current URL:</div>
          <div className="font-mono text-xs break-all">{window.location.href}</div>
          <div className="text-muted-foreground">Supabase URL:</div>
          <div className="flex items-center gap-2">
            {supabaseUrl ? <><CheckCircle2 className="h-4 w-4 text-profit" /><span className="font-mono text-xs">...{supabaseUrl?.slice(-20)}</span></> : <><XCircle className="h-4 w-4 text-loss" /><span className="text-loss">Missing</span></>}
          </div>
          <div className="text-muted-foreground">Supabase Key:</div>
          <div className="flex items-center gap-2">
            {supabaseKey ? <><CheckCircle2 className="h-4 w-4 text-profit" /><span className="font-mono text-xs">...{supabaseKey?.slice(-8)}</span></> : <><XCircle className="h-4 w-4 text-loss" /><span className="text-loss">Missing</span></>}
          </div>
        </div>
      </Card>

      {/* Auth State */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Authentication State</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading auth state...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">User ID:</div>
            <div className="font-mono text-xs break-all">{user?.id || <span className="text-loss">Not logged in</span>}</div>
            <div className="text-muted-foreground">Email:</div>
            <div className="font-mono text-xs">{user?.email || '-'}</div>
            <div className="text-muted-foreground">Session Expires:</div>
            <div className="font-mono text-xs">{session?.expires_at ? new Date(session.expires_at * 1000).toLocaleString() : '-'}</div>
            <div className="text-muted-foreground">Profile Display Name:</div>
            <div>{profile?.display_name || '-'}</div>
          </div>
        )}
      </Card>

      {/* Role State */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Role State</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="text-muted-foreground">userRole object:</div>
          <div className="font-mono text-xs break-all">{JSON.stringify(userRole)}</div>
          <div className="text-muted-foreground">userRole.role:</div>
          <div className="font-mono text-xs">{userRole?.role || <span className="text-loss">null</span>}</div>
          <div className="text-muted-foreground">isAdmin:</div>
          <div className="flex items-center gap-2">
            {isAdmin ? <><CheckCircle2 className="h-4 w-4 text-profit" /><span className="text-profit font-medium">true</span></> : <><XCircle className="h-4 w-4 text-loss" /><span className="text-loss">false</span></>}
          </div>
        </div>
      </Card>

      {/* Push Notifications Debug */}
      <PushDebugPanel />

      {/* Edge Function Tests */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-foreground">Edge Function Tests</h2>
        <div className="space-y-3">
          {(['stripe-sales', 'contact-support'] as const).map((fn) => (
            <div key={fn} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <StatusIcon status={testResults[fn].status} />
                <div>
                  <div className="font-medium text-sm">{fn}</div>
                  {testResults[fn].message && <div className="text-xs text-muted-foreground mt-1 max-w-md break-all">{testResults[fn].message}</div>}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => testEdgeFunction(fn)} disabled={testResults[fn].status === 'loading'}>
                <RefreshCw className="h-3 w-3 mr-1" />Test
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Links */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Quick Links</h2>
        <div className="flex flex-wrap gap-2">
          {['/dashboard', '/admin', '/sales', '/settings', '/settings/notifications'].map((path) => (
            <Button key={path} variant="outline" size="sm" asChild>
              <a href={path}>{path.split('/').pop() || 'Dashboard'}</a>
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Diagnostics;
