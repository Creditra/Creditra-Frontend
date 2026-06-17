import { BrowserRouter, Route, Routes, Link, NavLink } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { WalletProvider } from "./context/WalletContext";
import { WalletButton } from "./components/WalletButton";
import DrawCreditPage from "./pages/DrawCreditPage";
import CreditLines from "./pages/CreditLines";
import { TransactionHistory } from "./pages/TransactionHistory";
import { RequestEvaluation } from "./pages/RequestEvaluation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotFound } from "./pages/NotFound";

/**
 * Application root.
 *
 * Composition order is load-bearing:
 *
 *   <ErrorBoundary>          // catches render errors in everything below
 *     <WalletProvider>       // wallet lifecycle visible to every route
 *       <BrowserRouter>      // route tree
 *         <header />         // rendered outside <Routes/> so it persists
 *         <main>
 *           <Routes />       // current route
 *         </main>
 *       </BrowserRouter>
 *     </WalletProvider>
 *   </ErrorBoundary>
 *
 * The error boundary is the outer wrapper so a failure inside the
 * wallet reducer still renders the fallback page rather than a blank
 * screen. The header sits outside `<Routes>` so a route change never
 * dismounts the wallet button or the navigation chrome.
 *
 * See `docs/ARCHITECTURE.md` for the full component topology.
 */
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
              <nav className="header-nav">
                {/* 
                  NavLink with render function allows us to:
                  1. Apply active class for styling (accent + underline + weight)
                  2. Set aria-current="page" on active links for accessibility
                  
                  This satisfies WCAG 2.1 AA requirements:
                  - 1.4.1: Use of Color - active state uses color + other visual indicators
                  - 2.4.7: Focus Visible - outline differs from active underline
                  - 2.4.8: Location - aria-current="page" indicates current page
                */}
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    isActive ? "header-nav-link active" : "header-nav-link"
                  }
                >
                  Dashboard
                </NavLink>
                <NavLink
                  to="/transactions"
                  className={({ isActive }) =>
                    isActive ? "header-nav-link active" : "header-nav-link"
                  }
                >
                  Transactions
                </NavLink>
                <NavLink
                  to="/credit-lines"
                  className={({ isActive }) =>
                    isActive ? "header-nav-link active" : "header-nav-link"
                  }
                >
                  Credit Lines
                </NavLink>
                <NavLink
                  to="/open-credit"
                  className={({ isActive }) =>
                    isActive ? "header-nav-link active" : "header-nav-link"
                  }
                >
                  Open Credit Line
                </NavLink>
              </nav>
              <WalletButton />
            </header>
            <main className="main">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<TransactionHistory />} />
                <Route path="/credit-lines" element={<CreditLines />} />
                <Route path="/draw-credit" element={<DrawCreditPage />} />
                <Route
                  path="/draw-credit/success"
                  element={<DrawCreditPage />}
                />
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
