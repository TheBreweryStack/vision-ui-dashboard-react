import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { NotificationCenter } from './NotificationCenter';

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-[400px] sm:w-[400px] p-0 bg-card border-l border-border"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <NotificationCenter 
          onClose={() => onOpenChange(false)} 
          className="h-full"
        />
      </SheetContent>
    </Sheet>
  );
}
