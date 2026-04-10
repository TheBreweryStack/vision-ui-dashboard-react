import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTwoFactor } from '@/hooks/useTwoFactor';
import { Shield, Loader2, AlertCircle, KeyRound, Clock } from 'lucide-react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';

interface TwoFactorChallengeModalProps {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TwoFactorChallengeModal({
  open,
  onSuccess,
  onCancel,
}: TwoFactorChallengeModalProps) {
  const { verifyTotp, isLoading, error, errorDetails, setError } = useTwoFactor();
  
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showTimeSyncHelp, setShowTimeSyncHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setCode('');
      setBackupCode('');
      setTrustDevice(false);
      setUseBackupCode(false);
      setFailedAttempts(0);
      setShowTimeSyncHelp(false);
      setError(null);
    }
  }, [open, setError]);

  const handleVerify = useCallback(async (codeToVerify?: string) => {
    const finalCode = codeToVerify || (useBackupCode ? backupCode.trim().toUpperCase() : code);
    
    if (!useBackupCode && finalCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    if (useBackupCode && !backupCode.trim()) {
      setError('Please enter a backup code');
      return;
    }

    const result = await verifyTotp(finalCode, {
      isSetup: false,
      trustDevice,
      useBackupCode,
    });

    if (result?.success) {
      onSuccess();
    } else {
      // Track failed attempts and show time sync help after 2+ failures
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      
      // Show time sync help after 2 failed attempts (if not already shown via TIME_DRIFT)
      if (newAttempts >= 2 && !useBackupCode && !showTimeSyncHelp) {
        setShowTimeSyncHelp(true);
      }
    }
  }, [useBackupCode, backupCode, code, verifyTotp, trustDevice, onSuccess, failedAttempts, showTimeSyncHelp, setError]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6 && !useBackupCode) {
      handleVerify(code);
    }
  }, [code, useBackupCode, handleVerify]);

  // Show time sync help immediately if TIME_DRIFT error is detected
  useEffect(() => {
    if (errorDetails?.code === 'TIME_DRIFT') {
      setShowTimeSyncHelp(true);
    }
  }, [errorDetails]);

  const toggleBackupCode = () => {
    setUseBackupCode(!useBackupCode);
    setCode('');
    setBackupCode('');
    setError(null);
  };

  // Check if the error is a session/token issue
  const isSessionError = errorDetails?.code === 'NO_TOKEN';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            {useBackupCode
              ? 'Enter one of your backup codes'
              : 'Enter the 6-digit code from your authenticator app'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {useBackupCode ? (
            <div className="space-y-2">
              <Label htmlFor="backup-code">Backup Code</Label>
              <input
                id="backup-code"
                type="text"
                placeholder="Enter backup code"
                value={backupCode}
                onChange={(e) => {
                  setBackupCode(e.target.value);
                  setError(null);
                }}
                className="w-full px-3 py-2 border rounded-md bg-background text-foreground"
                autoFocus
              />
            </div>
          ) : (
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setError(null);
                }}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive justify-center">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-center">{error}</span>
            </div>
          )}

          {/* Time Drift / Time Sync Help */}
          {showTimeSyncHelp && !useBackupCode && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                <p className="text-sm text-yellow-600 dark:text-yellow-500 font-medium">
                  Codes not working?
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                TOTP codes require your phone's clock to be accurate. 
                Please enable "Set time automatically" in your device settings:
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                • <strong>iPhone:</strong> Settings → General → Date & Time<br />
                • <strong>Android:</strong> Settings → System → Date & time
              </p>
              {errorDetails?.driftSeconds && (
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                  Your device appears to be off by ~{Math.abs(errorDetails.driftSeconds)} seconds.
                </p>
              )}
            </div>
          )}

          {/* Session expired guidance */}
          {isSessionError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive font-medium">
                Session expired
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Please cancel and sign in again to continue.
              </p>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="trust-device"
              checked={trustDevice}
              onCheckedChange={(checked) => setTrustDevice(checked === true)}
            />
            <Label
              htmlFor="trust-device"
              className="text-sm font-normal cursor-pointer"
            >
              Remember this device for 30 days
            </Label>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => handleVerify()}
              disabled={isLoading || (!useBackupCode && code.length !== 6) || (useBackupCode && !backupCode.trim())}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleBackupCode}
              className="text-muted-foreground"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {useBackupCode ? 'Use authenticator app instead' : 'Use a backup code instead'}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-muted-foreground"
            >
              Cancel sign in
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
