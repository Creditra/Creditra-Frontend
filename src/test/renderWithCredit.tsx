import type { ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreditDataProvider } from '../context/CreditDataContext';
import { WalletProvider } from '../context/WalletContext';
import { MockCreditDataSource } from '../services/credit/mockCreditDataSource';
import type { CreditDataSource } from '../services/credit/CreditDataSource';
import { getGlobalCreditLines, getMockRefetchError } from '../hooks/useCreditLines';
import type { CreditLine } from '../types/creditLine';
import type { WalletInfo } from '../types/wallet';

const TEST_WALLET: WalletInfo = {
  type: 'freighter',
  publicKey: 'GTESTCREDITDATAOWNER',
  network: 'TESTNET',
};

export interface RenderWithCreditOptions extends Omit<RenderOptions, 'wrapper'> {
  lines?: CreditLine[];
  source?: CreditDataSource;
  wallet?: WalletInfo | null;
  route?: string;
  withRouter?: boolean;
}

export function renderWithCredit(
  ui: React.ReactElement,
  {
    lines,
    source,
    wallet = TEST_WALLET,
    route = '/',
    withRouter = true,
    ...options
  }: RenderWithCreditOptions = {},
) {
  const mockSource = new MockCreditDataSource(lines ?? getGlobalCreditLines());
  const creditSource: CreditDataSource = source ?? {
    listCreditLines: async (borrower, requestOptions) => {
      const error = getMockRefetchError();
      if (error) throw error;
      return mockSource.listCreditLines(borrower, requestOptions);
    },
    getCreditLine: (id, requestOptions) => mockSource.getCreditLine(id, requestOptions),
  };
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const content = (
      <CreditDataProvider source={creditSource}>
        {withRouter ? <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter> : children}
      </CreditDataProvider>
    );
    return typeof WalletProvider === 'function'
      ? <WalletProvider initialWallet={wallet}>{content}</WalletProvider>
      : <>{content}</>;
  };
  return render(ui, { wrapper: Wrapper, ...options });
}

export { TEST_WALLET };
