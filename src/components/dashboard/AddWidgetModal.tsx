import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { WidgetMeta } from '@/hooks/useDashboardWidgets';

interface AddWidgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableWidgets: WidgetMeta[];
  onAdd: (id: string) => void;
}

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({
  open,
  onOpenChange,
  availableWidgets,
  onAdd,
}) => {
  const statWidgets = availableWidgets.filter(w => w.category === 'stat');
  const cardWidgets = availableWidgets.filter(w => w.category === 'card');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto scroll-area">
        <DialogHeader>
          <DialogTitle>Add Widget</DialogTitle>
          <DialogDescription>Choose widgets to add to your dashboard.</DialogDescription>
        </DialogHeader>

        {availableWidgets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            All widgets are already on your dashboard.
          </p>
        ) : (
          <div className="space-y-5">
            {statWidgets.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Stats</h3>
                <div className="space-y-1.5">
                  {statWidgets.map(w => (
                    <WidgetRow key={w.id} widget={w} onAdd={onAdd} />
                  ))}
                </div>
              </div>
            )}
            {cardWidgets.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cards</h3>
                <div className="space-y-1.5">
                  {cardWidgets.map(w => (
                    <WidgetRow key={w.id} widget={w} onAdd={onAdd} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const WidgetRow: React.FC<{ widget: WidgetMeta; onAdd: (id: string) => void }> = ({ widget, onAdd }) => {
  const Icon = widget.icon;
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors">
      <div className="icon-box-primary h-8 w-8 shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{widget.label}</p>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
            {widget.defaultSize.w}×{widget.defaultSize.h}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{widget.description}</p>
      </div>
      <Button size="sm" variant="ghost" className="shrink-0 h-8 w-8 p-0" onClick={() => onAdd(widget.id)}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
};
