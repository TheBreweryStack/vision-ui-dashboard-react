import { DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function DividendsComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="p-4 rounded-2xl bg-yellow-500/10 mb-6">
        <DollarSign className="h-12 w-12 text-yellow-500" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2">Dividend Tracker & Planner</h2>
      <Badge variant="outline" className="mb-4 text-yellow-500 border-yellow-500/30">
        Coming Soon
      </Badge>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
        Track dividend income, monitor yield, plan reinvestments, and visualize your passive income growth over time.
      </p>
    </div>
  );
}
