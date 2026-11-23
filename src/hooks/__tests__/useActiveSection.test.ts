import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useActiveSection } from '../useActiveSection';

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

let observerInstances: MockIntersectionObserver[] = [];

class MockIntersectionObserver {
  callback: ObserverCallback;
  options?: IntersectionObserverInit;
  observedElements: Element[] = [];
  unobservedElements: Element[] = [];
  disconnected = false;

  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    observerInstances.push(this);
  }

  observe = vi.fn((el: Element) => {
    this.observedElements.push(el);
  });

  unobserve = vi.fn((el: Element) => {
    this.unobservedElements.push(el);
  });

  disconnect = vi.fn(() => {
    this.disconnected = true;
  });

  trigger(entries: Array<{ target: Element; isIntersecting: boolean; intersectionRatio: number }>) {
    this.callback(entries as unknown as IntersectionObserverEntry[]);
  }
}

describe('useActiveSection', () => {
  beforeEach(() => {
    observerInstances = [];
    document.body.innerHTML = '';

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('observes DOM elements matching provided sectionIds', () => {
    const sec1 = document.createElement('div');
    sec1.id = 'sec-1';
    const sec2 = document.createElement('div');
    sec2.id = 'sec-2';
    document.body.appendChild(sec1);
    document.body.appendChild(sec2);

    renderHook(() => useActiveSection(['sec-1', 'sec-2']));

    expect(observerInstances).toHaveLength(1);
    const observer = observerInstances[0];
    expect(observer.observe).toHaveBeenCalledTimes(2);
    expect(observer.observedElements).toEqual([sec1, sec2]);
  });

  it('ignores missing element ids without throwing', () => {
    const sec1 = document.createElement('div');
    sec1.id = 'sec-1';
    document.body.appendChild(sec1);

    // 'sec-missing' is not in DOM
    renderHook(() => useActiveSection(['sec-1', 'sec-missing']));

    expect(observerInstances).toHaveLength(1);
    const observer = observerInstances[0];
    expect(observer.observe).toHaveBeenCalledTimes(1);
    expect(observer.observedElements).toEqual([sec1]);
  });

  it('returns the id with the highest intersection ratio', () => {
    const sec1 = document.createElement('div');
    sec1.id = 'sec-1';
    const sec2 = document.createElement('div');
    sec2.id = 'sec-2';
    const sec3 = document.createElement('div');
    sec3.id = 'sec-3';
    document.body.appendChild(sec1);
    document.body.appendChild(sec2);
    document.body.appendChild(sec3);

    const { result } = renderHook(() => useActiveSection(['sec-1', 'sec-2', 'sec-3']));
    expect(result.current).toBeNull();

    const observer = observerInstances[0];

    // Trigger entries where sec-2 has highest ratio
    act(() => {
      observer.trigger([
        { target: sec1, isIntersecting: true, intersectionRatio: 0.25 },
        { target: sec2, isIntersecting: true, intersectionRatio: 0.85 },
        { target: sec3, isIntersecting: true, intersectionRatio: 0.4 },
      ]);
    });

    expect(result.current).toBe('sec-2');

    // Trigger new update where sec-3 becomes primary
    act(() => {
      observer.trigger([
        { target: sec1, isIntersecting: false, intersectionRatio: 0 },
        { target: sec2, isIntersecting: true, intersectionRatio: 0.3 },
        { target: sec3, isIntersecting: true, intersectionRatio: 0.9 },
      ]);
    });

    expect(result.current).toBe('sec-3');
  });

  it('disconnects and unobserves all elements on unmount', () => {
    const sec1 = document.createElement('div');
    sec1.id = 'sec-1';
    const sec2 = document.createElement('div');
    sec2.id = 'sec-2';
    document.body.appendChild(sec1);
    document.body.appendChild(sec2);

    const { unmount } = renderHook(() => useActiveSection(['sec-1', 'sec-2']));
    const observer = observerInstances[0];

    unmount();

    expect(observer.unobserve).toHaveBeenCalledTimes(2);
    expect(observer.unobservedElements).toEqual([sec1, sec2]);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(observer.disconnected).toBe(true);
  });

  it('does not re-create observer when re-rendering with an equal id array (new array reference)', () => {
    const sec1 = document.createElement('div');
    sec1.id = 'sec-1';
    const sec2 = document.createElement('div');
    sec2.id = 'sec-2';
    document.body.appendChild(sec1);
    document.body.appendChild(sec2);

    const { rerender } = renderHook(
      ({ ids }) => useActiveSection(ids),
      { initialProps: { ids: ['sec-1', 'sec-2'] } },
    );

    expect(observerInstances).toHaveLength(1);

    // Pass brand-new array literal with identical contents
    rerender({ ids: ['sec-1', 'sec-2'] });
    expect(observerInstances).toHaveLength(1);

    // Pass another new array literal
    rerender({ ids: ['sec-1', 'sec-2'] });
    expect(observerInstances).toHaveLength(1);
    expect(observerInstances[0].disconnect).not.toHaveBeenCalled();
  });

  it('re-subscribes when sectionIds actually change', () => {
    const sec1 = document.createElement('div');
    sec1.id = 'sec-1';
    const sec2 = document.createElement('div');
    sec2.id = 'sec-2';
    const sec3 = document.createElement('div');
    sec3.id = 'sec-3';
    document.body.appendChild(sec1);
    document.body.appendChild(sec2);
    document.body.appendChild(sec3);

    const { rerender } = renderHook(
      ({ ids }) => useActiveSection(ids),
      { initialProps: { ids: ['sec-1', 'sec-2'] } },
    );

    expect(observerInstances).toHaveLength(1);
    const firstObserver = observerInstances[0];

    // Change the ids list
    rerender({ ids: ['sec-1', 'sec-2', 'sec-3'] });

    // First observer should have been disconnected and a second created
    expect(firstObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(observerInstances).toHaveLength(2);
    expect(observerInstances[1].observedElements).toEqual([sec1, sec2, sec3]);
  });
});
