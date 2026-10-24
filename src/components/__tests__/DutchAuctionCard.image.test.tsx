import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MOCK_DUTCH_AUCTIONS } from '../../data/mockDutchAuctions';
import { DutchAuctionCard } from '../DutchAuctionCard';

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({ wallet: null, status: 'disconnected' }),
}));

describe('DutchAuctionCard NFT image', () => {
  it('resolves images and applies privacy-conscious image attributes and alt text', () => {
    const auction = {
      ...MOCK_DUTCH_AUCTIONS[0],
      nft: { ...MOCK_DUTCH_AUCTIONS[0].nft, image: 'ipfs://bafybeigdyrzt5sfp7udm7hu76uhv3h4q6wnx3u6qb7wmxjv6q2u6xq2f4/1.png' },
    };
    render(<DutchAuctionCard auction={auction} />);

    const image = screen.getByRole('img', { name: 'Cosmic Ape #1234 from Ape Universe' });
    expect(image).toHaveAttribute(
      'src',
      'https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uhv3h4q6wnx3u6qb7wmxjv6q2u6xq2f4/1.png',
    );
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(image).toHaveAttribute('decoding', 'async');
    expect(image).toHaveAttribute('width', '120');
    expect(image).toHaveAttribute('height', '120');
  });

  it('renders an accessible same-size placeholder when an image fails to load', () => {
    render(<DutchAuctionCard auction={MOCK_DUTCH_AUCTIONS[0]} />);
    const image = screen.getByRole('img', { name: 'Cosmic Ape #1234 from Ape Universe' });

    fireEvent.error(image);

    const placeholder = screen.getByRole('img', { name: 'Cosmic Ape #1234 from Ape Universe' });
    expect(placeholder.tagName).toBe('DIV');
    expect(placeholder).toHaveStyle({ width: '120px', height: '120px' });
    expect(placeholder).toHaveTextContent('AU');
  });

  it('renders the placeholder without creating an image for a rejected URL', () => {
    const auction = {
      ...MOCK_DUTCH_AUCTIONS[0],
      nft: { ...MOCK_DUTCH_AUCTIONS[0].nft, image: 'javascript:alert(1)' },
    };
    const { container } = render(<DutchAuctionCard auction={auction} />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cosmic Ape #1234 from Ape Universe' })).toHaveStyle({
      width: '120px',
      height: '120px',
    });
  });
});
