import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, UserRole } from '@/lib/supabase';
import { prefetchDashboardData, clearPrefetchCache } from '@/hooks/useDataPrefetch';

type TransitionType = 'signin' | 'signout' | null;

interface Pending2FA {
  userId: string;
  session: Session;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRole | null;
  userRoles: UserRole[];
  isLoading: boolean;
  isRoleLoading: boolean;
  isAdmin: boolean;
  authTransition: TransitionType;
  pending2FA: Pending2FA | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; requires2FA?: boolean }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  complete2FALogin: () => Promise<void>;
  cancel2FALogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [authTransition, setAuthTransition] = useState<TransitionType>(null);
  const [pending2FA, setPending2FA] = useState<Pending2FA | null>(null);
  
  // Use ref to track current user ID to prevent stale async updates
  const currentUserIdRef = useRef<string | null>(null);
  // Track if we're handling sign-in manually (to prevent onAuthStateChange flash)
  const handlingSignInRef = useRef(false);

  const fetchProfileAndRoles = async (userId: string) => {
    // Guard against stale updates
    if (currentUserIdRef.current !== userId) {
      console.log('[AuthContext] Skipping stale fetch for user:', userId);
      return;
    }

    console.log('[AuthContext] fetchProfileAndRoles called for userId:', userId);
    setIsRoleLoading(true);

    try {
      const [profileResult, rolesResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('id, user_id, role').eq('user_id', userId),
      ]);

      // Double-check we're still working with the current user
      if (currentUserIdRef.current !== userId) {
        console.log('[AuthContext] Discarding stale results for user:', userId);
        return;
      }

      console.log('[AuthContext] Profile result:', profileResult.data ? 'found' : 'not found', profileResult.error);
      console.log('[AuthContext] Roles result:', rolesResult.data, rolesResult.error);

      if (!profileResult.error && profileResult.data) {
        setProfile(profileResult.data);
      }

      const roles = rolesResult.data || [];
      setUserRoles(roles);
      
      // Pick primary role (prefer admin/owner, then first role)
      const adminRow = roles.find(r => r.role === 'admin' || r.role === 'owner');
      const picked = adminRow ?? roles[0] ?? null;
      setUserRole(picked);

      console.log('[AuthContext] Set userRoles:', roles.length, 'roles');
      console.log('[AuthContext] Picked role:', picked?.role ?? 'none');
    } catch (error) {
      console.error('[AuthContext] Error fetching profile/roles:', error);
    } finally {
      if (currentUserIdRef.current === userId) {
        setIsRoleLoading(false);
      }
    }
  };

  useEffect(() => {
    console.log('[AuthContext] Initializing...', {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? 'present' : 'missing',
      supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'present' : 'missing',
    });

    let mounted = true;

    // Check for existing session FIRST
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      console.log('[AuthContext] Initial session check:', session?.user?.id ?? 'no session');
      
      currentUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfileAndRoles(session.user.id).finally(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setIsRoleLoading(false);
        setIsLoading(false);
      }
    });

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('[AuthContext] Auth state changed:', event, session?.user?.id);
        
        // Skip SIGNED_IN events when we're handling sign-in manually
        // This prevents the dashboard flash before 2FA check
        if (event === 'SIGNED_IN' && handlingSignInRef.current) {
          console.log('[AuthContext] Ignoring SIGNED_IN event - handled manually in signIn()');
          return;
        }
        
        const newUserId = session?.user?.id ?? null;
        
        // Only process if user actually changed
        if (currentUserIdRef.current !== newUserId) {
          currentUserIdRef.current = newUserId;
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Fetch profile and roles for new user
            fetchProfileAndRoles(session.user.id);
          } else {
            // Clear all user data
            setProfile(null);
            setUserRole(null);
            setUserRoles([]);
            setIsRoleLoading(false);
          }
        }
        
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Compute isAdmin from ALL roles (not just picked role)
  const isAdmin = userRoles.some(r => r.role === 'admin' || r.role === 'owner');

  // Helper to complete the full sign-in flow (after password auth and optional 2FA)
  const completeSignInFlow = async (user: User, session: Session): Promise<{ error: Error | null; requires2FA: boolean }> => {
    currentUserIdRef.current = user.id;
    
    // Fetch profile and roles FIRST before showing transition
    const [profileResult, rolesResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('user_roles').select('id, user_id, role').eq('user_id', user.id),
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data);
    }

    const roles = rolesResult.data || [];
    setUserRoles(roles);
    
    const adminRow = roles.find(r => r.role === 'admin' || r.role === 'owner');
    const picked = adminRow ?? roles[0] ?? null;
    setUserRole(picked);
    setIsRoleLoading(false);
    
    // NOW set user and session - this triggers MainLayout to render
    setUser(user);
    setSession(session);
    
    // Show transition with profile data already loaded
    setAuthTransition('signin');
    
    // Start prefetching dashboard data
    prefetchDashboardData(user.id);
    
    // Keep transition visible slightly longer so prefetch completes
    setTimeout(() => {
      setAuthTransition(null);
      handlingSignInRef.current = false;
    }, 1800);
    
    return { error: null, requires2FA: false };
  };

  const signIn = async (email: string, password: string): Promise<{ error: Error | null; requires2FA?: boolean }> => {
    // Mark that we're handling sign-in manually to prevent onAuthStateChange flash
    handlingSignInRef.current = true;
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      handlingSignInRef.current = false;
      return { error: error as Error | null, requires2FA: false };
    }
    
    if (!data.user || !data.session) {
      handlingSignInRef.current = false;
      return { error: new Error('No user data returned'), requires2FA: false };
    }
    
    // Check if user has verified 2FA
    const { data: totpData } = await supabase
      .from('totp_secrets')
      .select('verified')
      .eq('user_id', data.user.id)
      .maybeSingle();
    
    if (totpData?.verified) {
      // User has 2FA enabled - check for trusted device
      const deviceToken = localStorage.getItem('tradecafe_trusted_device');
      
      if (deviceToken) {
        try {
          const { data: trustResult } = await supabase.functions.invoke('check-trusted-device', {
            body: { deviceToken },
          });
          
          if (trustResult?.trusted) {
            console.log('[AuthContext] Device trusted, skipping 2FA');
            return await completeSignInFlow(data.user, data.session);
          }
        } catch (e) {
          console.error('[AuthContext] Error checking trusted device:', e);
        }
        
        // Invalid token - remove it
        localStorage.removeItem('tradecafe_trusted_device');
      }
      
      // 2FA required - store pending state, DON'T set user yet
      console.log('[AuthContext] 2FA required, showing challenge modal');
      setPending2FA({ userId: data.user.id, session: data.session });
      return { error: null, requires2FA: true };
    }
    
    // No 2FA - complete login
    return await completeSignInFlow(data.user, data.session);
  };

  // Called after successful 2FA verification
  const complete2FALogin = async () => {
    if (!pending2FA) return;
    
    console.log('[AuthContext] 2FA verified, completing login');
    
    // Get fresh user data from the session
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await completeSignInFlow(user, pending2FA.session);
    }
    setPending2FA(null);
  };

  // Called when user cancels 2FA
  const cancel2FALogin = async () => {
    console.log('[AuthContext] 2FA cancelled, signing out');
    await supabase.auth.signOut();
    setPending2FA(null);
    handlingSignInRef.current = false;
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const termsAcceptedAt = new Date().toISOString();
    const termsVersion = "v1";
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          display_name: displayName,
          terms_accepted: true,
          terms_accepted_at: termsAcceptedAt,
          terms_version: termsVersion,
        },
      },
    });
    
    if (!error && data.user) {
      // Create profile entry with terms acceptance
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        display_name: displayName,
        terms_accepted_at: termsAcceptedAt,
        terms_version: termsVersion,
      });
    }
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setAuthTransition('signout');
    
    // Reset role loading state so next login waits for fresh role data
    setIsRoleLoading(true);
    
    // Clear ref immediately
    currentUserIdRef.current = null;
    
    // Clear prefetch cache
    clearPrefetchCache();
    
    // Show transition screen for a moment
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
    setUserRoles([]);
    setAuthTransition(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
    
    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }
    
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error as Error | null };
  };

  const value = {
    user,
    session,
    profile,
    userRole,
    userRoles,
    isLoading,
    isRoleLoading,
    isAdmin,
    authTransition,
    pending2FA,
    signIn,
    signUp,
    signOut,
    updateProfile,
    resetPassword,
    complete2FALogin,
    cancel2FALogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
