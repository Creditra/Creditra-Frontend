import { isValidAccountId } from './strkey';

/**
 * Helpers for displaying Stellar public keys / addresses in UI surfaces
 * where the full 56-character key would be visually overwhelming.
 */

const DEFAULT_LEAD = 6;
const DEFAULT_TAIL = 4;

/**
 * Truncate a Stellar address to a `leading…trailing` form suitable for
 * dense UI surfaces (badges, tooltips, table cells).
 *
 * Short strings shorter than `lead + tail` are returned untouched so the
 * caller doesn't have to guard against odd inputs.
 *
 * @example
 *   shortenAddress('GABCDEF...XYZ123')      // => 'GABCDE…Z123'
 *   shortenAddress('GABCDEF...XYZ123', 4,2) // => 'GABC…23'
 */
export function shortenAddress(
  address: string,
  lead: number = DEFAULT_LEAD,
  tail: number = DEFAULT_TAIL,
): string {
  if (!address) return '';
  if (address.length <= lead + tail) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** @deprecated Use isValidAccountId, which verifies the StrKey checksum. */
export function looksLikeStellarAddress(address: string): boolean {
  return isValidAccountId(address);
}
