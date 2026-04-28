import { BrowserRouter, Route, Routes, Link } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { WalletProvider } from "./context/WalletContext";
import { WalletButton } from "./components/WalletButton";
import DrawCreditPage from "./pages/DrawCreditPage";
import { TransactionHistory } from "./pages/TransactionHistory";
import { RequestEvaluation } from "./pages/RequestEvaluation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotFound } from "./pages/NotFound";

function App() {
  return (
    <ErrorBoundary>
      <WalletProvider>
        <BrowserRouter>
          <div className="app">
            <header className="header">
              <Link to="/" className="logo">
                Creditra
              </Link>
              <nav>
                <Link to="/">Dashboard</Link>
                <Link to="/transactions">Transactions</Link>
                <Link to="/credit-lines">Credit Lines</Link>
                <Link to="/open-credit">Open Credit Line</Link>
              </nav>
              <WalletButton />
            </header>
            <main className="main">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<TransactionHistory />} />
                <Route path="/draw-credit" element={<DrawCreditPage />} />
                <Route path="/open-credit" element={<RequestEvaluation />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </WalletProvider>
    </ErrorBoundary>
  );
}

export default App;
