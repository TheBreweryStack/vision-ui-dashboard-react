import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTwoFactor } from '@/hooks/useTwoFactor';
import { Shield, Copy, Check, Loader2, AlertCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface TwoFactorSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

type SetupStep = 'intro' | 'qrcode' | 'verify' | 'backup-codes' | 'success';

export function TwoFactorSetupModal({ open, onOpenChange, onComplete }: TwoFactorSetupModalProps) {
  const { setupTotp, verifyTotp, isLoading, error, setError } = useTwoFactor();
  
  const [step, setStep] = useState<SetupStep>('intro');
  const [secret, setSecret] = useState<string>('');
  const [otpauthUrl, setOtpauthUrl] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep('intro');
      setSecret('');
      setOtpauthUrl('');
      setVerificationCode('');
      setError(null);
      setBackupCodes([]);
      setCopiedCode(null);
    }
  }, [open, setError]);

  const handleStartSetup = async () => {
    const result = await setupTotp();
    if (result) {
      setSecret(result.secret);
      setOtpauthUrl(result.otpauthUrl);
      setStep('qrcode');
    }
  };

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success('Secret copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    const result = await verifyTotp(verificationCode, { isSetup: true });
    if (result?.success) {
      // Check if backup codes were returned
      if (result.backupCodes && result.backupCodes.length > 0) {
        setBackupCodes(result.backupCodes);
        setStep('backup-codes');
      } else {
        setStep('success');
      }
      toast.success('Two-factor authentication enabled!');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyAllCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast.success('All codes copied to clipboard');
  };

  const handleComplete = () => {
    onOpenChange(false);
    onComplete?.();
  };

  const formatSecret = (s: string) => {
    // Format secret in groups of 4 for readability
    return s.match(/.{1,4}/g)?.join(' ') ?? s;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Set Up Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Add an extra layer of security to your account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'intro' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Smartphone className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">What you'll need:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• An authenticator app on your phone</li>
                    <li>• Google Authenticator, Authy, or 1Password</li>
                  </ul>
                </div>
              </div>

              <Button 
                onClick={handleStartSetup} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </div>
          )}

          {step === 'qrcode' && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG
                  value={otpauthUrl}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Scan this QR code with your authenticator app
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Can't scan? Enter this code manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                    {formatSecret(secret)}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopySecret}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button onClick={() => setStep('verify')} className="w-full">
                I've scanned the code
              </Button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification-code">
                  Enter the 6-digit code from your app
                </Label>
                <Input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setVerificationCode(value);
                    setError(null);
                  }}
                  className="text-center text-2xl tracking-widest font-mono"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('qrcode')}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={isLoading || verificationCode.length !== 6}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Enable'
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'backup-codes' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm text-yellow-600 dark:text-yellow-500 font-medium">
                  ⚠️ Save these backup codes in a secure place. They won't be shown again!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <button
                    key={index}
                    onClick={() => handleCopyCode(code)}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border/50 text-sm font-mono hover:bg-secondary/80 transition-colors"
                  >
                    <span>{code}</span>
                    {copiedCode === code ? (
                      <Check className="h-3 w-3 text-primary" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>

              <Button onClick={handleCopyAllCodes} variant="outline" className="w-full">
                <Copy className="h-4 w-4 mr-2" />
                Copy All Codes
              </Button>

              <Button onClick={() => setStep('success')} className="w-full">
                I've Saved My Codes
              </Button>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-8 w-8 text-primary" />
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg">2FA Enabled!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your account is now protected with two-factor authentication.
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg text-left">
                <p className="text-sm font-medium mb-2">Important:</p>
                <p className="text-sm text-muted-foreground">
                  Keep your backup codes safe. You'll need them if you lose access to your authenticator app.
                </p>
              </div>

              <Button onClick={handleComplete} className="w-full">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
