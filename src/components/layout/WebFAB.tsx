import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AddTradeModal } from '@/components/journal/AddTradeModal';
import { useTrades } from '@/hooks/useTrades';

const WebFAB: React.FC = () => {
  const { addTrade } = useTrades();
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const location = useLocation();

  // Hide FAB on Journal page since it has its own Add Trade button
  const isJournalPage = location.pathname === '/journal';

  const handleClick = () => {
    // Simulate haptic feedback with visual animation
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
    setShowAddTrade(true);
  };

  const handleTradeSubmit = async (trade: Parameters<ReturnType<typeof useTrades>['addTrade']>[0]) => {
    const result = await addTrade(trade);
    if (!result.error) {
      setShowAddTrade(false);
    }
    return result;
  };

  // Don't render on Journal page
  if (isJournalPage) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button - Desktop Only */}
      <button
        onClick={handleClick}
        className={cn(
          "hidden lg:flex fixed bottom-8 right-8 z-40",
          "items-center justify-center w-14 h-14 rounded-full",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40",
          "transition-all duration-200 ease-out",
          "hover:scale-105",
          isPressed && "scale-90"
        )}
        aria-label="Add Trade"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {/* Add Trade Modal */}
      <AddTradeModal
        open={showAddTrade}
        onOpenChange={setShowAddTrade}
        onSubmit={handleTradeSubmit}
      />
    </>
  );
};

export default WebFAB;
