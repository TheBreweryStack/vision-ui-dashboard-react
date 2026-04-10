import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { TradeInboxContent } from '@/components/journal/TradeInboxContent';
import { Inbox } from 'lucide-react';

const TradeInbox: React.FC = () => {
  const [searchParams] = useSearchParams();
  // Support both itemId (preferred) and tradeId (legacy) query params
  const itemId = searchParams.get('itemId') || searchParams.get('tradeId');

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6 animate-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="icon-box-primary">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="page-title">Trade Inbox</h1>
            <p className="page-subtitle">Review and import trades from email</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <TradeInboxContent mode="page" initialItemId={itemId} />
    </div>
  );
};

export default TradeInbox;
