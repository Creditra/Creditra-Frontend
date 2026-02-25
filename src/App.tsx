import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { CreditLines } from './pages/CreditLines';
import { WalletProvider } from './context/WalletContext';
import { WalletButton } from './components/WalletButton';

function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <div className="app">
          <header className="header">
            <Link to="/" className="logo">Creditra</Link>
            <nav>
              <Link to="/">Dashboard</Link>
              <Link to="/credit-lines">Credit Lines</Link>
            </nav>
            <WalletButton />
          </header>
          <main className="main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/credit-lines" element={<CreditLines />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </WalletProvider>
  );
}

export default App;
