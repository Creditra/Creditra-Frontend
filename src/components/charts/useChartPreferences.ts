import { useEffect, useState } from 'react';

export interface ChartPreferences {
  prefersReducedMotion: boolean;
  forcedColors: boolean;
}

/**
 * Tracks OS/browser accessibility media queries relevant to SVG charts:
 * `prefers-reduced-motion: reduce` and `forced-colors: active`.
 */
export function useChartPreferences(): ChartPreferences {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [forcedColors, setForcedColors] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const forcedColorsQuery = window.matchMedia('(forced-colors: active)');

    const update = () => {
      setPrefersReducedMotion(reducedMotionQuery.matches);
      setForcedColors(forcedColorsQuery.matches);
    };

    update();
    reducedMotionQuery.addEventListener?.('change', update);
    forcedColorsQuery.addEventListener?.('change', update);

    return () => {
      reducedMotionQuery.removeEventListener?.('change', update);
      forcedColorsQuery.removeEventListener?.('change', update);
    };
  }, []);

  return { prefersReducedMotion, forcedColors };
}
