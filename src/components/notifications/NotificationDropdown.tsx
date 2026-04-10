import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationCenter } from './NotificationCenter';

interface NotificationDropdownProps {
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  alignOffset?: number;
}

export function NotificationDropdown({ 
  children, 
  side = 'bottom',
  align = 'end',
  sideOffset = 12,
  alignOffset = 0,
}: NotificationDropdownProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-[calc(100vw-32px)] max-w-[380px] h-[70vh] max-h-[520px] p-0 shadow-2xl border-border bg-background rounded-xl overflow-hidden" 
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        collisionPadding={16}
        avoidCollisions={true}
      >
        <NotificationCenter 
          onClose={() => setOpen(false)} 
        />
      </PopoverContent>
    </Popover>
  );
}
