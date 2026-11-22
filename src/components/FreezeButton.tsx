import { useState, useCallback } from 'react';
import { Snowflake } from 'lucide-react';
import { canTransition } from '../lib/credit-line-status';
import './FreezeButton.css';

interface FreezeButtonProps {
  lineId: string;
  lineName: string;
  frozen: boolean;
  onFreeze: (lineId: string) => void;
  onUnfreeze: (lineId: string) => void;
  className?: string;
}

export function FreezeButton({
  lineId,
  lineName,
  frozen,
  onFreeze,
  onUnfreeze,
  className = '',
}: FreezeButtonProps) {
  const [confirming, setConfirming] = useState(false);

  const label = frozen ? 'Unfreeze' : 'Freeze';
  const confirmLabel = frozen
    ? `Unfreeze ${lineName}?`
    : `Freeze ${lineName}?`;
  const confirmDescription = frozen
    ? 'This credit line will be reactivated. Draws and payments will resume.'
    : 'Draws will be blocked. Interest will continue to accrue. You can unfreeze at any time.';
  const currentStatus = frozen ? 'Frozen' : 'Active';
  const nextStatus = frozen ? 'Active' : 'Frozen';
  const transitionAllowed = canTransition(currentStatus, nextStatus);

  const handleConfirm = useCallback(() => {
    setConfirming(false);
    if (!transitionAllowed) return;
    if (frozen) {
      onUnfreeze(lineId);
    } else {
      onFreeze(lineId);
    }
  }, [frozen, lineId, onFreeze, onUnfreeze, transitionAllowed]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirming(false);
      }
    },
    [],
  );

  if (confirming) {
    return (
      <div
        className="freeze-confirm"
        role="dialog"
        aria-label={`Confirm ${label.toLowerCase()} for ${lineName}`}
        onKeyDown={handleKeyDown}
      >
        <p className="freeze-confirm__title">{confirmLabel}</p>
        <p className="freeze-confirm__desc">{confirmDescription}</p>
        <div className="freeze-confirm__actions">
          <button
            onClick={() => setConfirming(false)}
            className="freeze-btn freeze-btn--cancel"
            aria-label={`Cancel ${label.toLowerCase()}`}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!transitionAllowed}
            className={`freeze-btn freeze-btn--confirm ${frozen ? 'freeze-btn--unfreeze' : 'freeze-btn--freeze'}`}
            aria-label={`Confirm ${label.toLowerCase()}`}
          >
            {label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={!transitionAllowed}
      className={`freeze-btn freeze-btn--trigger ${frozen ? 'freeze-btn--unfreeze' : 'freeze-btn--freeze'} ${className}`}
      aria-label={`${label} ${lineName}`}
      aria-haspopup="dialog"
    >
      <Snowflake className="freeze-btn__icon" aria-hidden="true" />
      {label}
    </button>
  );
}
