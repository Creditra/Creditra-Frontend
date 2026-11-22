import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SuccessState from './SuccessState';
import { getCreditNetworkConfig } from '../config/creditNetwork';

vi.mock('../config/creditNetwork', () => ({
  getCreditNetworkConfig: vi.fn(),
}));

const mockedGetCreditNetworkConfig = vi.mocked(getCreditNetworkConfig);

describe('SuccessState explorer link', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('links to the testnet explorer when configured for TESTNET', () => {
    mockedGetCreditNetworkConfig.mockReturnValue({
      network: 'TESTNET',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test Stellar Network ; February 2015',
      creditContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
    });

    render(<SuccessState type="draw" transactionId="tx-123" onClose={vi.fn()} />);

    const link = screen.getByRole('link', { name: /view on stellarexpert/i });
    expect(link).toHaveAttribute('href', 'https://stellar.expert/explorer/testnet/tx/tx-123');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links to the public explorer when configured for PUBLIC', () => {
    mockedGetCreditNetworkConfig.mockReturnValue({
      network: 'PUBLIC',
      horizonUrl: 'https://horizon.stellar.org',
      sorobanRpcUrl: 'https://soroban.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
      creditContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
    });

    render(<SuccessState type="repay" transactionId="tx-456" onClose={vi.fn()} />);

    const link = screen.getByRole('link', { name: /view on stellarexpert/i });
    expect(link).toHaveAttribute('href', 'https://stellar.expert/explorer/public/tx/tx-456');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('falls back to the public explorer when reading network config throws', () => {
    mockedGetCreditNetworkConfig.mockImplementation(() => {
      throw new Error('Invalid config');
    });

    render(<SuccessState type="draw" transactionId="tx-fallback" onClose={vi.fn()} />);

    const link = screen.getByRole('link', { name: /view on stellarexpert/i });
    expect(link).toHaveAttribute('href', 'https://stellar.expert/explorer/public/tx/tx-fallback');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('URL-encodes transaction IDs with special characters', () => {
    mockedGetCreditNetworkConfig.mockReturnValue({
      network: 'TESTNET',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test Stellar Network ; February 2015',
      creditContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
    });

    const specialId = 'tx/123?foo=bar&baz=1#frag';
    render(<SuccessState type="draw" transactionId={specialId} onClose={vi.fn()} />);

    const link = screen.getByRole('link', { name: /view on stellarexpert/i });
    expect(link).toHaveAttribute(
      'href',
      `https://stellar.expert/explorer/testnet/tx/${encodeURIComponent(specialId)}`,
    );
  });

  it('hides the explorer link when transactionId is missing', () => {
    mockedGetCreditNetworkConfig.mockReturnValue({
      network: 'TESTNET',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test Stellar Network ; February 2015',
      creditContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
    });

    render(<SuccessState type="evaluation" onClose={vi.fn()} />);

    expect(screen.queryByRole('link', { name: /view on stellarexpert/i })).not.toBeInTheDocument();
  });
});
