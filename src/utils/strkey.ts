export type StrKeyVersion =
  | 'ed25519Public'
  | 'ed25519Secret'
  | 'muxed'
  | 'preAuthTx'
  | 'sha256Hash'
  | 'contract';

const VERSION_BYTES: Record<number, { version: StrKeyVersion; payloadLength: number }> = {
  [6 << 3]: { version: 'ed25519Public', payloadLength: 32 },
  [18 << 3]: { version: 'ed25519Secret', payloadLength: 32 },
  [12 << 3]: { version: 'muxed', payloadLength: 40 },
  [19 << 3]: { version: 'preAuthTx', payloadLength: 32 },
  [23 << 3]: { version: 'sha256Hash', payloadLength: 32 },
  [2 << 3]: { version: 'contract', payloadLength: 32 },
};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function crc16Xmodem(bytes: number[], end: number): number {
  let crc = 0;
  for (let i = 0; i < end; i += 1) {
    crc ^= bytes[i] << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/**
 * Decode a Stellar StrKey, returning null for unsupported or malformed input.
 */
export function decodeStrKey(
  s: unknown,
): { version: StrKeyVersion; payload: Uint8Array } | null {
  try {
    if (typeof s !== 'string' || (s.length !== 56 && s.length !== 69)) return null;

    const bytes: number[] = [];
    let accumulator = 0;
    let bits = 0;
    for (const character of s) {
      const value = BASE32_ALPHABET.indexOf(character);
      if (value < 0) return null;
      accumulator = (accumulator << 5) | value;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((accumulator >>> bits) & 0xff);
        accumulator &= (1 << bits) - 1;
      }
    }

    if (bits !== 0 && accumulator !== 0) return null;
    if (bytes.length < 3) return null;

    const metadata = VERSION_BYTES[bytes[0]];
    if (!metadata || bytes.length !== metadata.payloadLength + 3) return null;

    const checksumOffset = bytes.length - 2;
    const expectedChecksum = crc16Xmodem(bytes, checksumOffset);
    const actualChecksum = bytes[checksumOffset] | (bytes[checksumOffset + 1] << 8);
    if (expectedChecksum !== actualChecksum) return null;

    return {
      version: metadata.version,
      payload: Uint8Array.from(bytes.slice(1, checksumOffset)),
    };
  } catch {
    return null;
  }
}

export function isValidAccountId(s: unknown): s is string {
  return decodeStrKey(s)?.version === 'ed25519Public';
}
