import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import appIcon from "@/assets/app-icon.png";

const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check for valid recovery session on mount
  useEffect(() => {
    const checkSession = async () => {
      // Supabase handles the recovery token from URL hash automatically
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setHasValidSession(true);
      } else {
        // Check if there's a hash fragment that looks like a recovery token
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
          // Wait a moment for Supabase to process the token
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          setHasValidSession(!!retrySession);
        }
      }
      setIsChecking(false);
    };

    checkSession();

    // Listen for auth state changes (handles token processing)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasValidSession(true);
        setIsChecking(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const validateForm = (): boolean => {
    try {
      passwordSchema.parse(password);
    } catch (e) {
      if (e instanceof z.ZodError) {
        setError(e.errors[0].message);
        return false;
      }
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
        toast.error("Failed to reset password");
      } else {
        setSuccess(true);
        toast.success("Password reset successfully!");
        
        // Sign out and redirect to auth after a short delay
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate("/auth");
        }, 3000);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state while checking session
  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No valid session - show error
  if (!hasValidSession && !success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom">
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl p-8 animate-in text-center"
            style={{
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="flex flex-col items-center mb-6">
              <img src={appIcon} alt="TraderCafé" className="w-16 h-16 rounded-2xl mb-4 shadow-lg" />
              <div className="p-3 rounded-full bg-destructive/10 mb-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Invalid or Expired Link</h1>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            
            <Button
              onClick={() => navigate("/auth")}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom">
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl p-8 animate-in text-center"
            style={{
              background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div className="flex flex-col items-center mb-6">
              <img src={appIcon} alt="TraderCafé" className="w-16 h-16 rounded-2xl mb-4 shadow-lg" />
              <div className="p-3 rounded-full bg-primary/10 mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Password Reset!</h1>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              Your password has been successfully reset. You'll be redirected to sign in shortly.
            </p>
            
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Redirecting...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom">
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl p-8 animate-in"
          style={{
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <img src={appIcon} alt="TraderCafé" className="w-20 h-20 rounded-2xl mb-4 shadow-lg" />
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Reset Password
            </h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Enter your new password below
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground pr-12 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground pr-12 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-primary/35"
              disabled={submitting || !password || !confirmPassword}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Reset Password"
              )}
            </Button>

            {/* Back to Sign In */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
