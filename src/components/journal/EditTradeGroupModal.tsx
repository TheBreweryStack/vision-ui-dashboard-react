import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { TradeGroupWithFills } from '@/hooks/useTradeGroups';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

const editSchema = z.object({
  strategy: z.string().optional(),
  notes: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

interface EditTradeGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: TradeGroupWithFills | null;
  onSave: (groupId: string, data: { strategy?: string; notes?: string }) => Promise<void>;
}

export function EditTradeGroupModal({ open, onOpenChange, group, onSave }: EditTradeGroupModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      strategy: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open && group) {
      form.reset({
        strategy: group.strategy || '',
        notes: group.notes || '',
      });
    }
  }, [open, group, form]);

  const handleSubmit = async (data: EditFormData) => {
    if (!group) return;
    setIsSubmitting(true);
    try {
      await onSave(group.id, {
        strategy: data.strategy || undefined,
        notes: data.notes || undefined,
      });
      toast.success('Position updated');
      onOpenChange(false);
    } catch (error) {
      logger.error('Failed to update position:', error);
      toast.error('Failed to update position');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Edit {group.ticker} Position
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Position Info (Read-only) */}
            <div className="p-3 rounded-lg bg-muted/30 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{group.trade_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Quantity</p>
                  <p className="font-medium">{group.opened_qty} contracts</p>
                </div>
                {group.strike_price && (
                  <div>
                    <p className="text-xs text-muted-foreground">Strike</p>
                    <p className="font-medium">${group.strike_price}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Avg Entry</p>
                  <p className="font-medium">${group.avg_entry_price.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Strategy */}
            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Strategy</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Momentum, Earnings play, Scalp"
                      className="bg-secondary/50 border-border h-9 text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Trade notes, observations, lessons learned..."
                      className="bg-secondary/50 border-border min-h-[100px] resize-none text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}