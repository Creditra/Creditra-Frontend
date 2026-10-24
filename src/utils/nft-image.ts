const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
const MAX_DATA_IMAGE_BYTES = 256 * 1024;
const BASE58_CID = /^[A-HJ-NP-Za-km-z1-9]+$/;
const BASE32_CID = /^b[a-z2-7]+$/i;

export type NftImageFallbackReason =
  | 'empty'
  | 'unsupported_scheme'
  | 'invalid_url'
  | 'too_large';

export type NftImageResolution = { src: string } | { fallback: true; reason: NftImageFallbackReason };

const getIpfsGateway = (): string => {
  const configuredGateway = import.meta.env.VITE_IPFS_GATEWAY?.trim();
  if (!configuredGateway || !configuredGateway.endsWith('/')) return DEFAULT_IPFS_GATEWAY;

  try {
    const gateway = new URL(configuredGateway);
    if (
      gateway.protocol !== 'https:' ||
      !gateway.hostname ||
      gateway.username ||
      gateway.password ||
      gateway.search ||
      gateway.hash
    ) {
      return DEFAULT_IPFS_GATEWAY;
    }
    return gateway.href;
  } catch {
    return DEFAULT_IPFS_GATEWAY;
  }
};

const IPFS_GATEWAY = getIpfsGateway();

const isCid = (cid: string): boolean =>
  (cid.startsWith('Qm') && cid.length === 46 && BASE58_CID.test(cid)) ||
  ((cid.startsWith('b') || cid.startsWith('B')) && cid.length >= 10 && BASE32_CID.test(cid));

const resolveIpfsImage = (raw: string): NftImageResolution => {
  const match = /^ipfs:\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i.exec(raw);
  if (!match) return { fallback: true, reason: 'invalid_url' };

  let cid = match[1];
  let path = match[2] ?? '';
  if (cid.toLowerCase() === 'ipfs') {
    const pathMatch = /^\/([^/]+)(\/.*)?$/.exec(path);
    if (!pathMatch) return { fallback: true, reason: 'invalid_url' };
    cid = pathMatch[1];
    path = pathMatch[2] ?? '';
  }

  const hasUnsafePathSegment = path.split('/').some(segment => {
    try {
      const decoded = decodeURIComponent(segment);
      return decoded === '.' || decoded === '..' || decoded.includes('\\') || decoded.includes('/');
    } catch {
      return true;
    }
  });
  if (!isCid(cid) || hasUnsafePathSegment) {
    return { fallback: true, reason: 'invalid_url' };
  }

  return { src: `${IPFS_GATEWAY}${cid}${path}${match[3] ?? ''}${match[4] ?? ''}` };
};

const resolveDataImage = (raw: string): NftImageResolution => {
  if (/^data:image\/svg\+xml(?:;|,)/i.test(raw)) {
    return { fallback: true, reason: 'unsupported_scheme' };
  }

  const match = /^data:image\/(png|jpeg|webp|gif);base64,([a-z0-9+/]*={0,2})$/i.exec(raw);
  if (!match) return { fallback: true, reason: 'invalid_url' };

  const payload = match[2];
  if (
    payload.length === 0 ||
    payload.length % 4 !== 0 ||
    !/^(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i.test(payload)
  ) {
    return { fallback: true, reason: 'invalid_url' };
  }
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const payloadBytes = Math.floor((payload.length * 3) / 4) - padding;
  if (payloadBytes > MAX_DATA_IMAGE_BYTES) return { fallback: true, reason: 'too_large' };

  return { src: raw };
};

/**
 * Resolve NFT image metadata into an explicitly allowed browser image source.
 */
export const resolveNftImage = (raw: string): NftImageResolution => {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { fallback: true, reason: 'empty' };
  }

  const value = raw.trim();
  if (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) {
    return { src: value };
  }
  if (/^ipfs:/i.test(value)) return resolveIpfsImage(value);
  if (/^data:/i.test(value)) return resolveDataImage(value);
  if (/^https:/i.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || !url.hostname) {
        return { fallback: true, reason: 'invalid_url' };
      }
      return { src: url.href };
    } catch {
      return { fallback: true, reason: 'invalid_url' };
    }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) {
    return { fallback: true, reason: 'unsupported_scheme' };
  }
  return { fallback: true, reason: 'invalid_url' };
};
