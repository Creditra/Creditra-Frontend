import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DutchAuctionCard } from '../components/DutchAuctionCard';
import { EmptyState } from '@/components/EmptyState';
import { NoDataGraph } from '@/components/illustrations';
import { MOCK_DUTCH_AUCTIONS } from '../data/mockDutchAuctions';
import { COLOR } from '../utils/tokens';
import { purchaseAuction } from '../services/dutchAuctions';
import { getEffectiveStatus } from '../lib/dutch-auction-lifecycle';
import { WalletProvider } from '../context/WalletContext';
import {
  type DutchAuctionSortOption,
  DEFAULT_SORT_OPTION,
  isSortOption,
  sortAuctions,
} from '../lib/dutch-auction-sort';

export type AuctionStatusFilter = 'all' | 'scheduled' | 'active' | 'completed';

export function isAuctionStatusFilter(val: string | null | undefined): val is AuctionStatusFilter {
  return val === 'all' || val === 'scheduled' || val === 'active' || val === 'completed';
}

interface WalletFallbackBoundaryState {
  needsFallback: boolean;
}

class WalletFallbackBoundary extends React.Component<
  { children: React.ReactNode },
  WalletFallbackBoundaryState
> {
  state: WalletFallbackBoundaryState = { needsFallback: false };

  static getDerivedStateFromError(error: unknown): WalletFallbackBoundaryState | null {
    if (error instanceof Error && error.message.includes('WalletProvider')) {
      return { needsFallback: true };
    }
    return null;
  }

  componentDidCatch(error: unknown) {
    if (error instanceof Error && error.message.includes('WalletProvider')) {
      return;
    }
    throw error;
  }

  render() {
    if (this.state.needsFallback) {
      return <WalletProvider>{this.props.children}</WalletProvider>;
    }
    return this.props.children;
  }
}

export const DutchAuctionsView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get('status');
  const sortParam = searchParams.get('sort');
  const listSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const hasInvalidStatus = statusParam !== null && !isAuctionStatusFilter(statusParam);
  const hasInvalidSort = sortParam !== null && !isSortOption(sortParam);

  const [filter, setFilter] = useState<AuctionStatusFilter>(() =>
    isAuctionStatusFilter(statusParam) ? statusParam : 'all'
  );
  const [sort, setSort] = useState<DutchAuctionSortOption>(() =>
    isSortOption(sortParam) ? sortParam : DEFAULT_SORT_OPTION
  );

  useEffect(() => {
    if (isAuctionStatusFilter(statusParam)) {
      setFilter(statusParam);
    } else {
      setFilter('all');
    }
  }, [statusParam]);

  useEffect(() => {
    if (isSortOption(sortParam)) {
      setSort(sortParam);
    } else {
      setSort(DEFAULT_SORT_OPTION);
    }
  }, [sortParam]);

  // Rewrite invalid or unknown query param values with replace: true
  useEffect(() => {
    if (hasInvalidStatus || hasInvalidSort) {
      const nextParams = new URLSearchParams(searchParams);
      if (hasInvalidStatus) {
        nextParams.delete('status');
      }
      if (hasInvalidSort) {
        nextParams.delete('sort');
      }
      setSearchParams(nextParams, { replace: true });
    }
  }, [hasInvalidStatus, hasInvalidSort, searchParams, setSearchParams]);

  // Clock tick for decaying prices, ticking at most once per second
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const filteredAuctions = useMemo(() => {
    return MOCK_DUTCH_AUCTIONS.filter((auction) => {
      const effectiveStatus = getEffectiveStatus(auction, nowMs);
      if (filter === 'scheduled') return effectiveStatus === 'Scheduled';
      if (filter === 'active') return effectiveStatus === 'Active';
      if (filter === 'completed') {
        return (
          effectiveStatus === 'Completed' ||
          effectiveStatus === 'Ended' ||
          effectiveStatus === 'Cancelled'
        );
      }
      return true;
    });
  }, [filter, nowMs]);

  const sortedAuctions = useMemo(() => {
    return sortAuctions(filteredAuctions, sort, nowMs);
  }, [filteredAuctions, sort, nowMs]);

  // Result count polite live announcement on filter change
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const isFirstRender = useRef(true);
  const prevFilterRef = useRef(filter);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevFilterRef.current = filter;
      return;
    }

    if (prevFilterRef.current !== filter) {
      prevFilterRef.current = filter;
      const count = sortedAuctions.length;
      setLiveAnnouncement(`${count} ${count === 1 ? 'auction' : 'auctions'}`);
    }
  }, [filter, sortedAuctions.length]);

  // Focus preservation across re-sorts
  const focusedCardIdRef = useRef<string | null>(null);
  const focusedElementSelectorRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (focusedCardIdRef.current) {
      const card = document.querySelector(`[data-auction-id="${focusedCardIdRef.current}"]`) as HTMLElement | null;
      if (card) {
        if (focusedElementSelectorRef.current) {
          const inner = card.querySelector(focusedElementSelectorRef.current) as HTMLElement | null;
          if (inner && document.activeElement !== inner) {
            inner.focus();
            return;
          }
        }
        if (document.activeElement !== card && !card.contains(document.activeElement)) {
          card.focus();
        }
      }
    }
  }, [sortedAuctions]);

  const handleFilterChange = (newFilter: AuctionStatusFilter) => {
    setFilter(newFilter);
    const nextParams = new URLSearchParams(searchParams);
    if (newFilter === 'all') {
      nextParams.set('status', 'all');
    } else {
      nextParams.set('status', newFilter);
    }
    setSearchParams(nextParams);
  };

  const handleClearStatus = () => {
    setFilter('all');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('status');
    setSearchParams(nextParams);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = e.target.value as DutchAuctionSortOption;
    setSort(newSort);
    const nextParams = new URLSearchParams(searchParams);
    if (newSort === DEFAULT_SORT_OPTION) {
      nextParams.delete('sort');
    } else {
      nextParams.set('sort', newSort);
    }
    setSearchParams(nextParams);
  };

  const handlePurchase = async (auctionId: string, priceStroops: bigint) => {
    await purchaseAuction(auctionId, priceStroops);
  };

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

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div
          role="group"
          aria-label="Filter auctions by status"
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
        >
          {(['all', 'scheduled', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => handleFilterChange(f)}
              style={{
                padding: '0.5rem 1rem',
                minHeight: '44px',
                borderRadius: '6px',
                border: `1px solid ${COLOR.border}`,
                background: filter === f ? COLOR.accent : COLOR.surface,
                color: filter === f ? COLOR.bg : COLOR.text,
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                boxSizing: 'border-box',
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label
            htmlFor="auction-sort-select"
            style={{ fontSize: '0.85rem', color: COLOR.muted, fontWeight: 500 }}
          >
            Sort by
          </label>
          <select
            id="auction-sort-select"
            aria-label="Sort auctions"
            value={sort}
            onChange={handleSortChange}
            style={{
              padding: '0.5rem 0.75rem',
              minHeight: '44px',
              borderRadius: '6px',
              border: `1px solid ${COLOR.border}`,
              background: COLOR.surface,
              color: COLOR.text,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <option value="ending">Ending soonest</option>
            <option value="price">Lowest price</option>
            <option value="discount">Biggest discount</option>
          </select>
        </div>
      </div>

      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveAnnouncement}
      </div>

      <div
        onFocus={(e) => {
          const target = e.target as HTMLElement;
          const card = target.closest('[data-auction-id]') as HTMLElement | null;
          if (card) {
            focusedCardIdRef.current = card.getAttribute('data-auction-id');
            if (target === card) {
              focusedElementSelectorRef.current = null;
            } else if (target.id) {
              focusedElementSelectorRef.current = `#${target.id}`;
            } else if (target.tagName) {
              focusedElementSelectorRef.current = target.tagName.toLowerCase();
            }
          }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            focusedCardIdRef.current = null;
            focusedElementSelectorRef.current = null;
          }
        }}
      >
        {sortedAuctions.length === 0 ? (
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
                : { label: 'Show all auctions', onClick: handleClearStatus }
            }
          />
        ) : (
          sortedAuctions.map((auction) => (
            <div
              key={auction.id}
              data-auction-id={auction.id}
              data-testid={`auction-card-${auction.id}`}
              tabIndex={-1}
              style={{ outline: 'none' }}
            >
              <DutchAuctionCard
                auction={auction}
                listSearch={listSearch}
                onPurchase={handlePurchase}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const DutchAuctions: React.FC = () => {
  return (
    <WalletFallbackBoundary>
      <DutchAuctionsView />
    </WalletFallbackBoundary>
  );
};
