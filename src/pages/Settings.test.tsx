import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContrastProvider } from '../context/ContrastContext';
import { ReducedMotionProvider } from '../context/ReducedMotionContext';
import { ConfigError, getCreditNetworkConfig } from '../config/creditNetwork';
import { shortenAddress } from '../utils/format-address';
import { Settings } from './Settings';

vi.mock('../config/creditNetwork', async () => {
  const actual = await vi.importActual<typeof import('../config/creditNetwork')>(
    '../config/creditNetwork',
  );
  return {
    ...actual,
    getCreditNetworkConfig: vi.fn(),
  };
});

const mockedGetCreditNetworkConfig = vi.mocked(getCreditNetworkConfig);

const SAMPLE_CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

function renderSettings() {
  return render(
    <MemoryRouter>
      <ContrastProvider>
        <ReducedMotionProvider>
          <Settings />
        </ReducedMotionProvider>
      </ContrastProvider>
    </MemoryRouter>,
  );
}

describe('Settings Diagnostics footer', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    mockedGetCreditNetworkConfig.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  it('shows network and copyable truncated contract id for a valid TESTNET config', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    mockedGetCreditNetworkConfig.mockReturnValue({
      network: 'TESTNET',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test Stellar Network ; February 2015',
      creditContractId: SAMPLE_CONTRACT_ID,
    });

    renderSettings();

    expect(screen.getByRole('heading', { name: /diagnostics/i })).toBeInTheDocument();
    expect(screen.getByText('TESTNET')).toBeInTheDocument();

    const truncated = shortenAddress(SAMPLE_CONTRACT_ID);
    const displayedId = screen.getByText(truncated);
    expect(displayedId).toBeInTheDocument();
    expect(displayedId).toHaveAttribute('title', SAMPLE_CONTRACT_ID);

    const copyButton = screen.getByRole('button', { name: 'Copy credit contract id' });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeText).toHaveBeenCalledWith(SAMPLE_CONTRACT_ID);
    expect(copyButton).toHaveAttribute('data-copy-state', 'copied');
  });

  it('shows PUBLIC network when configured for mainnet', () => {
    mockedGetCreditNetworkConfig.mockReturnValue({
      network: 'PUBLIC',
      horizonUrl: 'https://horizon.stellar.org',
      sorobanRpcUrl: 'https://soroban.stellar.org',
      networkPassphrase: 'Public Global Stellar Network ; September 2015',
      creditContractId: SAMPLE_CONTRACT_ID,
    });

    renderSettings();

    expect(screen.getByText('PUBLIC')).toBeInTheDocument();
  });

  it('renders Configuration error and problem count instead of throwing when ConfigError occurs', () => {
    mockedGetCreditNetworkConfig.mockImplementation(() => {
      throw new ConfigError([
        'VITE_CREDIT_CONTRACT_ID is required.',
        'VITE_HORIZON_URL must use https:.',
      ]);
    });

    renderSettings();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Configuration error (2 problems)');
    expect(screen.queryByRole('button', { name: 'Copy credit contract id' })).not.toBeInTheDocument();
  });

  it('uses singular problem label when ConfigError has 1 problem', () => {
    mockedGetCreditNetworkConfig.mockImplementation(() => {
      throw new ConfigError(['VITE_CREDIT_CONTRACT_ID is required.']);
    });

    renderSettings();

    expect(screen.getByRole('alert')).toHaveTextContent('Configuration error (1 problem)');
  });

  it('handles missing contract id gracefully', () => {
    mockedGetCreditNetworkConfig.mockReturnValue({
      network: 'TESTNET',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test Stellar Network ; February 2015',
      creditContractId: '',
    });

    renderSettings();

    expect(screen.getByText('TESTNET')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy credit contract id' })).not.toBeInTheDocument();
  });

  it('truncates a very long contract id for display while copying the full value', async () => {
    const veryLongId = `C${'A'.repeat(120)}Z999`;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    mockedGetCreditNetworkConfig.mockReturnValue({
      network: 'TESTNET',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test Stellar Network ; February 2015',
      creditContractId: veryLongId,
    });

    renderSettings();

    const displayedId = screen.getByText(shortenAddress(veryLongId));
    expect(displayedId).toHaveAttribute('title', veryLongId);

    const copyButton = screen.getByRole('button', { name: 'Copy credit contract id' });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeText).toHaveBeenCalledWith(veryLongId);
  });

  it('shows copy error state without crashing when clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    mockedGetCreditNetworkConfig.mockReturnValue({
      network: 'TESTNET',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test Stellar Network ; February 2015',
      creditContractId: SAMPLE_CONTRACT_ID,
    });

    renderSettings();

    const copyButton = screen.getByRole('button', { name: 'Copy credit contract id' });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(copyButton).toHaveAttribute('data-copy-state', 'error');
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
