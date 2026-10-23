import { describe, expect, it } from 'vitest';
import { decodeStrKey, isValidAccountId } from '../strkey';

// Public, secret, muxed and contract vectors are from Stellar's js-stellar-base StrKey tests:
// https://github.com/stellar/js-stellar-base/blob/master/test/unit/strkey_test.js
// The T/X fixtures use bytes 0..31 encoded with the documented StrKey variants.
const PUBLIC_KEY = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const SECRET_SEED = 'SAB5556L5AN5KSR5WF7UOEFDCIODEWEO7H2UR4S5R62DFTQOGLKOVZDY';
const MUXED_ADDRESS =
  'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK';
const CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';
const PRE_AUTH_TX = 'TAAACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6ULG';
const SHA256_HASH = 'XAAACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB7QO7';

describe('decodeStrKey', () => {
  it('decodes a valid public key and verifies the account id', () => {
    const decoded = decodeStrKey(PUBLIC_KEY);
    expect(decoded?.version).toBe('ed25519Public');
    expect(decoded?.payload).toHaveLength(32);
    expect(isValidAccountId(PUBLIC_KEY)).toBe(true);
  });

  it('rejects a changed checksum', () => {
    expect(isValidAccountId(`${PUBLIC_KEY.slice(0, -1)}H`)).toBe(false);
  });

  it('decodes secret seeds without considering them account ids', () => {
    expect(decodeStrKey(SECRET_SEED)?.version).toBe('ed25519Secret');
    expect(isValidAccountId(SECRET_SEED)).toBe(false);
  });

  it('decodes muxed addresses without considering them account ids', () => {
    const decoded = decodeStrKey(MUXED_ADDRESS);
    expect(decoded?.version).toBe('muxed');
    expect(decoded?.payload).toHaveLength(40);
    expect(isValidAccountId(MUXED_ADDRESS)).toBe(false);
  });

  it('rejects nonzero unused base32 padding bits', () => {
    expect(decodeStrKey(`${MUXED_ADDRESS.slice(0, -1)}L`)).toBeNull();
  });

  it('recognizes pre-authorized transaction, hash, and contract versions', () => {
    expect(decodeStrKey(PRE_AUTH_TX)?.version).toBe('preAuthTx');
    expect(decodeStrKey(SHA256_HASH)?.version).toBe('sha256Hash');
    expect(decodeStrKey(CONTRACT_ID)?.version).toBe('contract');
  });

  it.each([null, undefined, 1, {}, '', 'g'.repeat(56), 'G'.repeat(55), 'G'.repeat(57)])(
    'returns null for malformed input %s',
    (value) => {
      expect(() => decodeStrKey(value)).not.toThrow();
      expect(decodeStrKey(value)).toBeNull();
      expect(isValidAccountId(value)).toBe(false);
    },
  );

  it('rejects an unknown version byte', () => {
    expect(decodeStrKey(`Z${PUBLIC_KEY.slice(1)}`)).toBeNull();
  });
});
