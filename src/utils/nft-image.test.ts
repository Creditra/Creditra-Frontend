import { describe, expect, it } from 'vitest';
import { resolveNftImage } from './nft-image';

describe('resolveNftImage', () => {
  it('preserves root-relative local assets', () => {
    expect(resolveNftImage('/nft/cosmic-ape.svg')).toEqual({ src: '/nft/cosmic-ape.svg' });
  });

  it('maps CIDv1 IPFS URIs to the default gateway', () => {
    expect(resolveNftImage('ipfs://bafybeigdyrzt5sfp7udm7hu76uhv3h4q6wnx3u6qb7wmxjv6q2u6xq2f4/1.png')).toEqual({
      src: 'https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uhv3h4q6wnx3u6qb7wmxjv6q2u6xq2f4/1.png',
    });
  });

  it('strips the ipfs/ URI prefix before mapping a CIDv0', () => {
    expect(resolveNftImage('ipfs://ipfs/QmYwAPJzv5CZsnAzt8auVTLg3tZ8xF5B4fM9bWz5V7F4fA/1.png')).toEqual({
      src: 'https://ipfs.io/ipfs/QmYwAPJzv5CZsnAzt8auVTLg3tZ8xF5B4fM9bWz5V7F4fA/1.png',
    });
  });

  it.each(['http://cdn.example/1.png', 'javascript:alert(1)', 'blob:https://example.test/id', 'file:///tmp/image.png'])(
    'rejects unsupported URI %s',
    uri => {
      expect(resolveNftImage(uri)).toEqual({ fallback: true, reason: 'unsupported_scheme' });
    },
  );

  it('allows valid HTTPS image URLs', () => {
    expect(resolveNftImage('https://cdn.example/1.png')).toEqual({ src: 'https://cdn.example/1.png' });
  });

  it('rejects protocol-relative URLs and invalid IPFS CIDs', () => {
    expect(resolveNftImage('//cdn.example/1.png')).toEqual({
      fallback: true,
      reason: 'unsupported_scheme',
    });
    expect(resolveNftImage('ipfs://not-a-cid/1.png')).toEqual({
      fallback: true,
      reason: 'invalid_url',
    });
  });

  it('allows supported base64 raster data images', () => {
    expect(resolveNftImage('data:image/png;base64,aGVsbG8=')).toEqual({
      src: 'data:image/png;base64,aGVsbG8=',
    });
  });

  it('allows a raster data image at exactly 256 KB', () => {
    const payload = `${'A'.repeat(4 * Math.ceil((256 * 1024) / 3) - 2)}==`;
    expect(resolveNftImage(`data:image/png;base64,${payload}`)).toEqual({
      src: `data:image/png;base64,${payload}`,
    });
  });

  it('rejects inline SVG data images', () => {
    expect(resolveNftImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toEqual({
      fallback: true,
      reason: 'unsupported_scheme',
    });
  });

  it('rejects raster data images larger than 256 KB', () => {
    const oversizedPayload = 'A'.repeat(4 * Math.ceil((300 * 1024) / 3));
    expect(resolveNftImage(`data:image/png;base64,${oversizedPayload}`)).toEqual({
      fallback: true,
      reason: 'too_large',
    });
  });

  it('reports empty and malformed inputs', () => {
    expect(resolveNftImage('  ')).toEqual({ fallback: true, reason: 'empty' });
    expect(resolveNftImage('https://')).toEqual({ fallback: true, reason: 'invalid_url' });
  });
});
