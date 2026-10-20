import { describe, expect, it } from 'vitest';
import { matchPath } from './matchPath';

describe('matchPath pure helper', () => {
  it('matches static routes with end: true', () => {
    expect(matchPath({ path: '/', end: true }, '/')).not.toBeNull();
    expect(matchPath({ path: '/transactions', end: true }, '/transactions')).not.toBeNull();
    expect(matchPath({ path: '/transactions', end: true }, '/transactions/details')).toBeNull();
    expect(matchPath({ path: '/credit-lines', end: true }, '/')).toBeNull();
  });

  it('matches prefix routes with end: false', () => {
    const match = matchPath({ path: '/credit-lines', end: false }, '/credit-lines/draw');
    expect(match).not.toBeNull();
    expect(match?.pathnameBase).toBe('/credit-lines');
  });

  it('extracts params correctly', () => {
    const match = matchPath({ path: '/users/:userId/orders/:orderId', end: true }, '/users/42/orders/999');
    expect(match).not.toBeNull();
    expect(match?.params).toEqual({
      userId: '42',
      orderId: '999',
    });
  });

  it('accepts string pattern defaulting to end: true', () => {
    expect(matchPath('/help', '/help')).not.toBeNull();
    expect(matchPath('/help', '/help/faq')).toBeNull();
  });

  it('returns null when static segments diverge', () => {
    expect(matchPath({ path: '/settings/notifications', end: true }, '/settings/security')).toBeNull();
  });
});
