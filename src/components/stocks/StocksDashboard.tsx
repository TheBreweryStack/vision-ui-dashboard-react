import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePortfolioHoldings } from '@/hooks/usePortfolioHoldings';
import { StocksKPICards } from './StocksKPICards';
import { SectorPieChart } from './SectorPieChart';
import { HoldingsTable } from './HoldingsTable';
import { AddHoldingModal } from './AddHoldingModal';
import { toast } from 'sonner';

export function StocksDashboard() {
  const {
    holdings,
    isLoading,
    totalValue,
    totalPnl,
    sectorAllocation,
    addHolding,
    deleteHolding,
    isAdding,
  } = usePortfolioHoldings();
  const [showAdd, setShowAdd] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      await deleteHolding(id);
      toast.success('Holding removed');
    } catch {
      toast.error('Failed to remove holding');
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <StocksKPICards holdings={holdings} totalValue={totalValue} totalPnl={totalPnl} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sector Allocation */}
        <div className="content-card p-4 lg:col-span-1">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Sector Allocation</h3>
          <SectorPieChart data={sectorAllocation} totalValue={totalValue} />
        </div>

        {/* Holdings Table */}
        <div className="content-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">Holdings</h3>
            <Button size="sm" onClick={() => setShowAdd(true)} className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
          <HoldingsTable holdings={holdings} totalValue={totalValue} onDelete={handleDelete} />
        </div>
      </div>

      <AddHoldingModal
        open={showAdd}
        onOpenChange={setShowAdd}
        onAdd={addHolding}
        isAdding={isAdding}
      />
    </div>
  );
}
