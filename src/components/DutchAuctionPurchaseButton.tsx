import { PendingButton } from './PendingButton';
import { fmt } from '../utils/tokens';

export interface DutchAuctionPurchaseButtonProps {
  /** Id of the auction being bought. */
  auctionId: string;
  /** Price the buyer is committing to right now. */
  price: number;
  /** Fired with the auction id and the price when the buyer confirms. */
  onPurchase?: (auctionId: string, price: number) => void;
  /** True while the purchase is in flight. */
  pending?: boolean;
  /** Label shown while `pending` is true. */
  pendingLabel?: string;
  className?: string;
}

/**
 * The one purchase action for Dutch auctions.
 *
 * The list card and the `/dutch-auctions/:auctionId` detail page both render
 * this component, so the price quoted in the button, the pending state and
 * the callback signature exist in exactly one implementation.
 */
export function DutchAuctionPurchaseButton({
  auctionId,
  price,
  onPurchase,
  pending = false,
  pendingLabel = 'Purchasing…',
  className,
}: DutchAuctionPurchaseButtonProps) {
  return (
    <PendingButton
      pending={pending}
      pendingLabel={pendingLabel}
      onClick={() => onPurchase?.(auctionId, price)}
      className={className}
      style={{ width: '100%' }}
    >
      Purchase Now for {fmt(price)}
    </PendingButton>
  );
}
