import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TradeInboxContent } from './TradeInboxContent';
import { Inbox } from 'lucide-react';

interface TradeInboxDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const TradeInboxDialog: React.FC<TradeInboxDialogProps> = ({
  trigger,
  open,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-lg w-full bg-card border-border max-h-[80vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-4 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Trade Inbox
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto scroll-area">
          <TradeInboxContent mode="dialog" onClose={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
