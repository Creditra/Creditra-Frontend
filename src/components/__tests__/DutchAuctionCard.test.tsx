import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DutchAuctionCard } from '../DutchAuctionCard';
import { MOCK_DUTCH_AUCTIONS } from '../../data/mockDutchAuctions';

vi.mock('../../context/WalletContext', () => ({ useWallet: () => ({ wallet: null, status: 'disconnected' }) }));

function renderCard() {
  return render(<DutchAuctionCard auction={MOCK_DUTCH_AUCTIONS[0]} />);
}

describe('DutchAuctionCard price alerts', () => {
  afterEach(() => localStorage.clear());

  it.each(['100', '900', '-5', '1e3', '1.12345678'])('rejects invalid target %s without storing it', value => {
    renderCard();
    fireEvent.change(screen.getByLabelText(/notify me at/i), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Target must be between');
    expect(localStorage.getItem('creditra_auction_alerts_v1')).toBeNull();
  });

  it('saves a target at the floor and offers removal', () => {
    renderCard();
    fireEvent.change(screen.getByLabelText(/notify me at/i), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Alert at $200.00')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('creditra_auction_alerts_v1') || '[]')[0].targetStroops).toBe(2_000_000_000);
  });
});