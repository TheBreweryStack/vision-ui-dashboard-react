import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { NotificationCenter } from './NotificationCenter';
import { haptics } from '@/lib/haptics';

interface MobileNotificationSheetProps {
  children: React.ReactNode;
}

export function MobileNotificationSheet({ children }: MobileNotificationSheetProps) {
  const [open, setOpen] = React.useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      haptics.light();
    }
    setOpen(newOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent 
        side="top" 
        className="h-[80vh] p-0 rounded-b-2xl bg-background border-b border-border/50"
        style={{ marginTop: 'calc(56px + env(safe-area-inset-top))' }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <div className="h-full overflow-hidden flex flex-col">
          <NotificationCenter onClose={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
