import { useState } from "react";
import { useWallet } from "../../context/WalletContext";
import {
  EXPECTED_NETWORK,
  isSwitchSupported,
  switchNetwork,
  WalletConnectError,
} from "../../utils/wallet";
import { TYPE_COLOR, TYPE_ICON } from "./notificationIcons";
import "./BannerAlert.css";

const GENERIC_SWITCH_ERROR = "Failed to switch network. Please switch manually in your wallet.";

export function NetworkMismatchBanner() {
  const { wallet, status, refreshWalletIdentity } = useWallet();
  const [dismissedNetworks, setDismissedNetworks] = useState<Record<string, boolean>>({});
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const dismissKey = wallet ? `networkMismatchDismissed:${wallet.network}` : null;
  const dismissed =
    dismissKey !== null &&
    (dismissedNetworks[wallet!.network] === true || sessionStorage.getItem(dismissKey) === "true");

  // Banner only shows on real mismatch, not during reconnect
  if (!wallet || status !== 'connected' || dismissed) return null;

  if (wallet.network === EXPECTED_NETWORK) return null;

  const handleDismiss = () => {
    if (!dismissKey) return;
    sessionStorage.setItem(dismissKey, "true");
    setDismissedNetworks((prev) => ({ ...prev, [wallet.network]: true }));
  };

  const supported = isSwitchSupported(wallet.type);

  const handleSwitch = async () => {
    if (!supported) return;
    setSwitchError(null);
    setIsSwitching(true);
    try {
      await switchNetwork(wallet.type, EXPECTED_NETWORK);
      // Pull the wallet's new network into context so `wallet.network` (and
      // any data cached against the old network, e.g. balances) reflects
      // the switch immediately — see WalletContext's cache-invalidation
      // notes (#961). This also re-renders the banner away once
      // `wallet.network === EXPECTED_NETWORK`.
      await refreshWalletIdentity();
    } catch (err: unknown) {
      if (err instanceof WalletConnectError) {
        setSwitchError(err.message);
      } else {
        setSwitchError(GENERIC_SWITCH_ERROR);
      }
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
          {switchError && (
            <span className="banner-error" role="alert" style={{ display: "block", marginTop: "0.25rem" }}>
              {switchError}
            </span>
          )}
        </span>
        
        <button
          type="button"
          className="banner-action"
          style={{ color: colors.text, opacity: supported ? 1 : 0.7 }}
          onClick={handleSwitch}
          disabled={!supported || isSwitching}
        >
          {buttonCopy}
        </button>
        
        <button
          type="button"
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
