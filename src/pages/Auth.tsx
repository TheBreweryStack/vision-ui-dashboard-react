import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Loader2, Download, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";
import appIcon from "@/assets/app-icon.png";
import AuthTransitionScreen from "@/components/auth/AuthTransitionScreen";
import { TwoFactorChallengeModal } from "@/components/auth/TwoFactorChallengeModal";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const displayNameSchema = z.string()
  .min(2, "Display name must be at least 2 characters")
  .max(50, "Display name must be less than 50 characters");

type AuthMode = 'signin' | 'signup' | 'forgot';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, resetPassword, isLoading, authTransition, pending2FA, complete2FALogin, cancel2FALogin } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Auth mode state
  const [mode, setMode] = useState<AuthMode>('signin');
  const [displayName, setDisplayName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (user && !isLoading && !authTransition) {
      navigate("/dashboard");
    }
  }, [user, isLoading, authTransition, navigate]);

  // PWA install prompt detection
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    // Password not required for forgot password mode
    if (mode !== 'forgot') {
      try {
        passwordSchema.parse(password);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.password = e.errors[0].message;
        }
      }
    }

    // Additional validation for sign-up mode
    if (mode === 'signup') {
      try {
        displayNameSchema.parse(displayName);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.displayName = e.errors[0].message;
        }
      }

      if (!acceptedTerms) {
        newErrors.terms = "You must agree to the Terms and Privacy Policy";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);

    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          toast.error(error.message);
        } else {
          setResetSent(true);
          toast.success("Check your email for the reset link!");
        }
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Try signing in.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Account created! Check your email to verify.");
          // Reset form
          setEmail("");
          setPassword("");
          setDisplayName("");
          setAcceptedTerms(false);
          setMode('signin');
        }
      } else {
        const { error, requires2FA } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Invalid email or password");
          } else {
            toast.error(error.message);
          }
        } else if (requires2FA) {
          // Don't navigate - 2FA modal will show via pending2FA state
          return;
        } else {
          toast.success("Welcome back! ☕");
          navigate("/dashboard");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Show transition screen during auth transitions
  if (authTransition) {
    return <AuthTransitionScreen type={authTransition} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom">
      {/* Auth Card */}
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
              TraderCafé <span className="text-xl">☕</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Your personal trading journal and market analysis platform
            </p>
          </div>

          {/* Mode Toggle */}
          {mode !== 'forgot' ? (
            <div className="flex justify-center gap-4 mb-6">
              <button
                type="button"
                onClick={() => { 
                  setMode('signin'); 
                  setErrors({}); 
                  setDisplayName(''); 
                  setAcceptedTerms(false); 
                  setResetSent(false);
                }}
                className={cn(
                  "text-sm font-medium transition-colors",
                  mode === 'signin' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign In
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                type="button"
                onClick={() => { 
                  setMode('signup'); 
                  setErrors({}); 
                  setResetSent(false);
                }}
                className={cn(
                  "text-sm font-medium transition-colors",
                  mode === 'signup' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-foreground">Reset Password</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your email and we'll send you a reset link
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Reset Sent Success Message */}
            {mode === 'forgot' && resetSent && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                <p className="text-sm text-foreground font-medium">Check your email!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  We've sent a password reset link to {email}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setResetSent(false);
                    setEmail('');
                  }}
                  className="text-sm text-primary hover:text-primary/80 mt-3 transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            )}

            {/* Display Name (Sign Up only) */}
            {mode === 'signup' && !resetSent && (
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-sm font-medium text-foreground">
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-12 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
                {errors.displayName && <p className="text-xs text-destructive">{errors.displayName}</p>}
              </div>
            )}

            {/* Email - Show when not in reset sent state */}
            {!resetSent && (
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="trader@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            )}

            {/* Password - Hide in forgot mode */}
            {mode !== 'forgot' && !resetSent && (

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
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
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>
            )}

            {/* Terms Checkbox (Sign Up only) */}
            {mode === 'signup' && !resetSent && (
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                    className="mt-0.5"
                  />
                  <label 
                    htmlFor="terms" 
                    className="text-sm text-muted-foreground leading-tight cursor-pointer"
                  >
                    I agree to the{" "}
                    <Link 
                      to="/terms" 
                      target="_blank" 
                      className="text-primary hover:text-primary/80 underline"
                    >
                      Terms of Service
                    </Link>
                    {" "}and{" "}
                    <Link 
                      to="/privacy" 
                      target="_blank" 
                      className="text-primary hover:text-primary/80 underline"
                    >
                      Privacy Policy
                    </Link>
                  </label>
                </div>
                {errors.terms && <p className="text-xs text-destructive">{errors.terms}</p>}
              </div>
            )}

            {/* Forgot Password (Sign In only) */}
            {mode === 'signin' && !resetSent && (
              <div className="text-left">
                <button
                  type="button"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                  onClick={() => {
                    setMode('forgot');
                    setErrors({});
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Back to Sign In (Forgot mode) */}
            {mode === 'forgot' && !resetSent && (
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    setMode('signin');
                    setErrors({});
                  }}
                >
                  ← Back to Sign In
                </button>
              </div>
            )}

            {/* Submit Button */}
            {!resetSent && (
            <Button
              type="submit"
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-primary/35"
              disabled={submitting || (mode === 'signup' && !acceptedTerms)}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : mode === 'forgot' ? (
                "Send Reset Link"
              ) : mode === 'signup' ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </Button>
            )}

            {/* Legal Links */}
            <div className="text-center text-sm text-muted-foreground">
              <Link to="/terms" className="text-primary hover:text-primary/80 underline">
                Terms of Service
              </Link>
              {" · "}
              <Link to="/privacy" className="text-primary hover:text-primary/80 underline">
                Privacy Policy
              </Link>
            </div>
          </form>

          {/* Contact */}
          <p className="mt-6 text-sm text-muted-foreground text-center">
            Contact us at{" "}
            <a href="mailto:support@tradercafe.app" className="text-primary hover:text-primary/80 transition-colors">
              support@thebrewerystack.com
            </a>
          </p>
        </div>

        {/* Install App Prompt */}
        {!isInstalled && (
          <div
            className="mt-4 rounded-xl p-4 flex items-center gap-3"
            style={{
              background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
            }}
          >
            <div className="p-2 rounded-lg bg-primary/10">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Install TraderCafé</p>
              <p className="text-xs text-muted-foreground">Add to home screen for the best experience</p>
            </div>
            {deferredPrompt ? (
              <Button
                size="sm"
                onClick={handleInstallClick}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Download className="h-4 w-4 mr-1" />
                Install
              </Button>
            ) : (
              <Link to="/install">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  How to Install
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 2FA Challenge Modal */}
      <TwoFactorChallengeModal
        open={!!pending2FA}
        onSuccess={async () => {
          await complete2FALogin();
          toast.success("Welcome back! ☕");
          navigate("/dashboard");
        }}
        onCancel={cancel2FALogin}
      />
    </div>
  );
};

export default Auth;
