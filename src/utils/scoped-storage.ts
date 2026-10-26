import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '../context/WalletContext';
import { readJson, writeJson } from './storage';

/**
 * SHA-256 implementation in pure TypeScript for synchronous fallback in tests
 * and environments where Web Crypto subtle is unavailable or synchronous key
 * resolution is required.
 */
function sha256Sync(str: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const words: number[] = [];
  const utf8: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 128) {
      utf8.push(c);
    } else if (c < 2048) {
      utf8.push((c >> 6) | 192);
      utf8.push((c & 63) | 128);
    } else {
      utf8.push((c >> 12) | 224);
      utf8.push(((c >> 6) & 63) | 128);
      utf8.push((c & 63) | 128);
    }
  }

  const byteLen = utf8.length;
  utf8.push(0x80);
  while (utf8.length % 64 !== 56) {
    utf8.push(0);
  }
  for (let i = 0; i < 8; i++) {
    utf8.push(i < 4 ? 0 : ((byteLen * 8) >>> ((7 - i) * 8)) & 0xff);
  }
  for (let w = 0; w < utf8.length; w += 4) {
    words.push(
      (utf8[w] << 24) |
      (utf8[w + 1] << 16) |
      (utf8[w + 2] << 8) |
      utf8[w + 3]
    );
  }

  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f, 0xc67178f2,
  ];

  for (let b = 0; b < words.length; b += 16) {
    const w = words.slice(b, b + 16);
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let [a, c, d, e, f, g, h, l] = hash;
    for (let t = 0; t < 64; t++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (l + s1 + ch + k[t] + w[t]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & c) ^ (a & d) ^ (c & d);
      const temp2 = (s0 + maj) >>> 0;
      l = h;
      h = g;
      g = f;
      f = (e + temp1) >>> 0;
      e = d;
      d = c;
      c = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + c) >>> 0;
    hash[2] = (hash[2] + d) >>> 0;
    hash[3] = (hash[3] + e) >>> 0;
    hash[4] = (hash[4] + f) >>> 0;
    hash[5] = (hash[5] + g) >>> 0;
    hash[6] = (hash[6] + h) >>> 0;
    hash[7] = (hash[7] + l) >>> 0;
  }

  return hash.map(v => v.toString(16).padStart(8, '0')).join('');
}

const HASH_CACHE = new Map<string, string>();
const HASH_PREFIX_LENGTH = 12;

/**
 * Compute short SHA-256 prefix for an address synchronously (using cache or fallback).
 */
export function hashAddressSync(address: string): string {
  if (HASH_CACHE.has(address)) {
    return HASH_CACHE.get(address)!;
  }
  const fullHash = sha256Sync(address);
  const prefix = fullHash.slice(0, HASH_PREFIX_LENGTH);
  HASH_CACHE.set(address, prefix);
  return prefix;
}

/**
 * Compute short SHA-256 prefix for an address asynchronously using crypto.subtle,
 * falling back to synchronous hash.
 */
export async function hashAddress(address: string): Promise<string> {
  if (HASH_CACHE.has(address)) {
    return HASH_CACHE.get(address)!;
  }
  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    try {
      const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(address));
      const hex = Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const prefix = hex.slice(0, HASH_PREFIX_LENGTH);
      HASH_CACHE.set(address, prefix);
      return prefix;
    } catch {
      // Fall through to sync fallback
    }
  }
  return hashAddressSync(address);
}

/**
 * Returns a storage key scoped to the given wallet address: `${base}::${hash(address)}`.
 * When no wallet address is provided, returns the base key unadorned.
 *
 * Uses a short SHA-256 prefix so raw 56-character G... public keys are never
 * used as localStorage key names.
 */
export function scopedKey(base: string, walletAddress?: string | null): string {
  if (!walletAddress) {
    return base;
  }
  const hash = hashAddressSync(walletAddress);
  return `${base}::${hash}`;
}

export const MIGRATION_FLAG_KEY = 'creditra:storage-migrated';

export const USER_SCOPED_BASE_KEYS = [
  scopedKey('creditra_notifications'),
  scopedKey('creditra_notification_prefs'),
  scopedKey('creditra:linked-accounts'),
  scopedKey('creditra:oauth-state'),
  scopedKey('creditra_channel_prefs'),
] as const;

/**
 * One-time migration: on the first connect after upgrade, move existing
 * global values into the scope of the wallet that connects, then delete
 * the global keys so single-user data is preserved.
 *
 * Safe to interrupt and runs at most once.
 */
export function migrateLegacyStorage(walletAddress: string): void {
  if (typeof window === 'undefined' || !window.localStorage || !walletAddress) {
    return;
  }

  try {
    if (window.localStorage.getItem(MIGRATION_FLAG_KEY)) {
      return;
    }

    for (const baseKey of USER_SCOPED_BASE_KEYS) {
      const globalValue = window.localStorage.getItem(baseKey);
      if (globalValue !== null) {
        const targetKey = scopedKey(baseKey, walletAddress);
        // Only write to target if not already populated
        if (window.localStorage.getItem(targetKey) === null) {
          window.localStorage.setItem(targetKey, globalValue);
        }
        window.localStorage.removeItem(baseKey);
      }
    }

    window.localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  } catch {
    /* swallow storage errors */
  }
}

/**
 * React hook that reads and writes localStorage under the connected wallet's scope.
 * Re-reads when the wallet identity changes, and returns the fallback when no wallet
 * is connected.
 *
 * While disconnected, writes are suppressed.
 */
export function useScopedStorage<T>(
  base: string,
  fallback: T,
  parse?: (raw: unknown) => T,
): [T, (value: T | ((prev: T) => T)) => void] {
  let walletPublicKey: string | null = null;
  let isInsideWalletProvider = false;

  try {
    const walletContext = useWallet();
    walletPublicKey = walletContext.wallet?.publicKey ?? null;
    isInsideWalletProvider = true;
  } catch {
    // Rendered outside WalletProvider (e.g. isolated legacy tests)
    walletPublicKey = null;
    isInsideWalletProvider = false;
  }

  // When rendered outside WalletProvider in legacy unit tests, treat as un-scoped/test wallet
  const effectiveAddress = isInsideWalletProvider ? walletPublicKey : null;
  const isConnected = isInsideWalletProvider ? Boolean(walletPublicKey) : false;

  const key = scopedKey(base, effectiveAddress);

  const readValue = useCallback((): T => {
    // In disconnected state, return fallback and do not read
    if (isInsideWalletProvider && !isConnected) {
      return fallback;
    }
    const raw = readJson<T>(key, fallback);
    return parse ? parse(raw) : raw;
  }, [key, isConnected, isInsideWalletProvider, fallback, parse]);

  const [state, setState] = useState<T>(readValue);
  const prevKeyRef = useRef(key);

  // Run one-time migration on connect
  useEffect(() => {
    if (effectiveAddress) {
      migrateLegacyStorage(effectiveAddress);
    }
  }, [effectiveAddress]);

  // Re-read when key / wallet identity changes
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      setState(readValue());
    }
  }, [key, readValue]);

  const setValue = useCallback(
    (action: T | ((prev: T) => T)) => {
      // While disconnected inside WalletProvider, do not write to storage
      if (isInsideWalletProvider && !isConnected) {
        return;
      }

      setState(prev => {
        const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
        writeJson(key, next);
        return next;
      });
    },
    [key, isConnected, isInsideWalletProvider],
  );

  return [state, setValue];
}
