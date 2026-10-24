
import React, { useState } from 'react';
import { DutchAuctionCard } from '../components/DutchAuctionCard';
import { EmptyState } from '@/components/EmptyState';
import { NoDataGraph } from '@/components/illustrations';
import { MOCK_DUTCH_AUCTIONS } from '../data/mockDutchAuctions';
import { COLOR } from '../utils/tokens';
import { getEffectiveStatus } from '../lib/dutch-auction-lifecycle';

export const DutchAuctions: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'active' | 'completed'>('all');

  const filteredAuctions = MOCK_DUTCH_AUCTIONS.filter(auction => {
    const effectiveStatus = getEffectiveStatus(auction);
    if (filter === 'scheduled') return effectiveStatus === 'Scheduled';
    if (filter === 'active') return effectiveStatus === 'Active';
    if (filter === 'completed') return effectiveStatus === 'Completed' || effectiveStatus === 'Ended' || effectiveStatus === 'Cancelled';
    return true;
  });



  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, color: COLOR.text, marginBottom: '0.5rem' }}>
          Dutch Auctions
        </h1>
        <p style={{ margin: 0, color: COLOR.muted, fontSize: '0.9rem' }}>
          Price decreases linearly until it hits the floor or sells out
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['all', 'scheduled', 'active', 'completed'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: `1px solid ${COLOR.border}`,
              background: filter === f ? COLOR.accent : COLOR.surface,
              color: filter === f ? COLOR.bg : COLOR.text,
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div>
        {filteredAuctions.length === 0 ? (
          <EmptyState
            data-testid="auctions-empty-state"
            illustration={<NoDataGraph className="empty-state-illustration--muted" />}
            title={
              filter === 'all'
                ? 'No auctions right now'
                : `No ${filter} auctions`
            }
            description={
              filter === 'all'
                ? 'Auctions appear here as soon as a sale is running. Check back later to catch the next price drop.'
                : 'Nothing matches this filter at the moment. Show all auctions to see everything that is scheduled or finished.'
            }
            primaryAction={
              filter === 'all'
                ? undefined
                : { label: 'Show all auctions', onClick: () => setFilter('all') }
            }
          />
        ) : (
          filteredAuctions.map(auction => (
            <DutchAuctionCard
              key={auction.id}
              auction={auction}
            />
          ))
        )}
      </div>
    </div>
  );
};

