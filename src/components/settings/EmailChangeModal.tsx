import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';

interface EmailChangeModalProps {
  open: boolean;
  onClose: () => void;
  currentEmail: string;
  newEmail: string;
  setNewEmail: (v: string) => void;
  isChangingEmail: boolean;
  emailChangeSuccess: boolean;
  onSubmit: () => void;
}

export const EmailChangeModal: React.FC<EmailChangeModalProps> = ({
  open,
  onClose,
  currentEmail,
  newEmail,
  setNewEmail,
  isChangingEmail,
  emailChangeSuccess,
  onSubmit,
}) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Change Email Address
          </DialogTitle>
          <DialogDescription>
            {emailChangeSuccess
              ? "We've sent confirmation emails to both your old and new email addresses."
              : "Enter your new email address. You'll need to confirm the change via email."}
          </DialogDescription>
        </DialogHeader>

        {emailChangeSuccess ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-profit/10 border border-profit/30">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-profit mt-0.5" />
                <div>
                  <p className="font-medium text-profit">Confirmation emails sent!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Check both <strong>{currentEmail}</strong> and <strong>{newEmail}</strong> for confirmation links.
                    Your email will update after you confirm both.
                  </p>
                </div>
              </div>
            </div>
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentEmail">Current Email</Label>
              <Input
                id="currentEmail"
                value={currentEmail}
                disabled
                className="bg-secondary/30 border-border/30 text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              You'll receive confirmation emails at both your old and new email addresses.
              The change will only complete after you confirm both.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onSubmit}
                disabled={isChangingEmail || !newEmail}
              >
                {isChangingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Confirmation
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
