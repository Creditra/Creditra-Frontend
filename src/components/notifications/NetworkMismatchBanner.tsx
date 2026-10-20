import { useState } from "react";
import { useWallet } from "../../context/WalletContext";
import { EXPECTED_NETWORK, isSwitchSupported, switchNetwork } from "../../utils/wallet";
import { TYPE_COLOR, TYPE_ICON } from "./notificationIcons";
import "./BannerAlert.css";

export function NetworkMismatchBanner() {
  const { wallet, status, refreshWalletIdentity } = useWallet();
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem("networkMismatchDismissed") === "true";
  });
  const [isSwitching, setIsSwitching] = useState(false);

  // Banner only shows on real mismatch, not during reconnect
  if (!wallet || status !== 'connected' || dismissed) return null;

  if (wallet.network === EXPECTED_NETWORK) return null;

  const handleDismiss = () => {
    sessionStorage.setItem("networkMismatchDismissed", "true");
    setDismissed(true);
  };

  const supported = isSwitchSupported(wallet.type);

  const handleSwitch = async () => {
    if (!supported) return;
    setIsSwitching(true);
    try {
      await switchNetwork(wallet.type, EXPECTED_NETWORK);
      // Pull the wallet's new network into context so `wallet.network` (and
      // any data cached against the old network, e.g. balances) reflects
      // the switch immediately — see WalletContext's cache-invalidation
      // notes (#961). This also re-renders the banner away once
      // `wallet.network === EXPECTED_NETWORK`.
      await refreshWalletIdentity();
    } catch (err: any) {
      // In a real app we'd show a toast error, but here we can just swallow or show.
      console.error(err);
    } finally {
      setIsSwitching(false);
    }
  };

  const colors = TYPE_COLOR["warning"];
  const icon = TYPE_ICON["warning"];

  // Fallback to instructional copy when switching is unsupported
  const buttonCopy = supported
    ? (isSwitching ? "Switching..." : "Switch network")
    : `Please switch to ${EXPECTED_NETWORK} in wallet`;

  return (
    <div className="banner-stack" style={{ position: "relative", zIndex: 1000, marginBottom: "1rem" }}>
      <div
        className="banner-alert"
        style={{ background: colors.bg, borderColor: colors.border }}
        role="alert"
      >
        <span
          className="banner-icon"
          style={{ color: colors.icon }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="banner-message">
          Network mismatch: App expects {EXPECTED_NETWORK} but your wallet is on {wallet.network}.
        </span>
        
        <button
          className="banner-action"
          style={{ color: colors.text, opacity: supported ? 1 : 0.7 }}
          onClick={handleSwitch}
          disabled={!supported || isSwitching}
        >
          {buttonCopy}
        </button>
        
        <button
          className="banner-close"
          onClick={handleDismiss}
          aria-label="Dismiss alert"
        >
          ×
        </button>
      </div>
    </div>
  );
}
