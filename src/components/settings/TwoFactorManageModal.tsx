import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Shield, Loader2, Copy, Check, KeyRound, AlertTriangle } from 'lucide-react';

interface TwoFactorManageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showDisableConfirm: boolean;
  setShowDisableConfirm: (v: boolean) => void;
  showBackupCodes: boolean;
  backupCodes: string[];
  copiedCode: string | null;
  disableVerificationCode: string;
  setDisableVerificationCode: (v: string) => void;
  backupCodeForDisable: string;
  setBackupCodeForDisable: (v: string) => void;
  useBackupForDisable: boolean;
  setUseBackupForDisable: (v: boolean) => void;
  disableError: string | null;
  setDisableError: (v: string | null) => void;
  isDisabling: boolean;
  onDisable2FA: () => void;
  onCancelDisable: () => void;
  onCopyCode: (code: string) => void;
  onCopyAllCodes: () => void;
  onCloseModal: () => void;
}

export const TwoFactorManageModal: React.FC<TwoFactorManageModalProps> = ({
  open,
  onOpenChange,
  showDisableConfirm,
  setShowDisableConfirm,
  showBackupCodes,
  backupCodes,
  copiedCode,
  disableVerificationCode,
  setDisableVerificationCode,
  backupCodeForDisable,
  setBackupCodeForDisable,
  useBackupForDisable,
  setUseBackupForDisable,
  disableError,
  setDisableError,
  isDisabling,
  onDisable2FA,
  onCancelDisable,
  onCopyCode,
  onCopyAllCodes,
  onCloseModal,
}) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) {
        setShowDisableConfirm(false);
        setDisableVerificationCode('');
        setDisableError(null);
      }
    }}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {showDisableConfirm ? 'Disable Two-Factor Authentication' : 'Manage Two-Factor Authentication'}
          </DialogTitle>
          <DialogDescription>
            {showDisableConfirm
              ? 'Enter your authenticator code to disable 2FA'
              : showBackupCodes && backupCodes.length > 0
                ? 'Save these backup codes in a secure location'
                : 'Manage your 2FA settings and trusted devices'}
          </DialogDescription>
        </DialogHeader>

        {showDisableConfirm ? (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
              <p className="text-sm text-destructive font-medium">
                Warning: This will remove 2FA protection from your account. You'll need to set it up again to re-enable.
              </p>
            </div>

            <div className="space-y-3">
              {useBackupForDisable ? (
                <>
                  <Label htmlFor="disable-backup-code">Enter one of your backup codes</Label>
                  <Input
                    id="disable-backup-code"
                    type="text"
                    placeholder="ABC123-DEF456"
                    value={backupCodeForDisable}
                    onChange={(e) => {
                      setBackupCodeForDisable(e.target.value);
                      setDisableError(null);
                    }}
                    className="text-center text-lg tracking-wide font-mono uppercase"
                    autoFocus
                  />
                </>
              ) : (
                <>
                  <Label htmlFor="disable-code">Enter 6-digit code from your authenticator app</Label>
                  <Input
                    id="disable-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={disableVerificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setDisableVerificationCode(value);
                      setDisableError(null);
                    }}
                    className="text-center text-2xl tracking-widest font-mono"
                    autoFocus
                  />
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUseBackupForDisable(!useBackupForDisable);
                  setDisableError(null);
                }}
                className="w-full text-muted-foreground"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                {useBackupForDisable ? 'Use authenticator code instead' : 'Use a backup code instead'}
              </Button>
            </div>

            {disableError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {disableError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={onCancelDisable}
                disabled={isDisabling}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={onDisable2FA}
                disabled={isDisabling || (!useBackupForDisable && disableVerificationCode.length !== 6) || (useBackupForDisable && !backupCodeForDisable.trim())}
                variant="destructive"
                className="flex-1"
              >
                {isDisabling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Disable'
                )}
              </Button>
            </div>
          </div>
        ) : showBackupCodes && backupCodes.length > 0 ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-sm text-yellow-500 font-medium">
                Warning: Save these backup codes in a secure place. They won't be shown again!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <button
                  key={index}
                  onClick={() => onCopyCode(code)}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border/50 text-sm font-mono hover:bg-secondary/80 transition-colors"
                >
                  <span>{code}</span>
                  {copiedCode === code ? (
                    <Check className="h-3 w-3 text-profit" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>

            <Button onClick={onCopyAllCodes} variant="outline" className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              Copy All Codes
            </Button>

            <DialogFooter>
              <Button onClick={onCloseModal}>
                I've Saved My Codes
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-profit/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-profit" />
                </div>
                <div>
                  <p className="font-medium text-foreground">2FA is enabled</p>
                  <p className="text-xs text-muted-foreground">Your account is protected with an authenticator app</p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Button
                onClick={() => setShowDisableConfirm(true)}
                variant="outline"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Disable 2FA
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onCloseModal}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
