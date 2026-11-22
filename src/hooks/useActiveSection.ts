import { useEffect, useState } from "react";

const DEFAULT_ROOT_MARGIN = "-80px 0px -60% 0px";

export function useActiveSection(
  sectionIds: string[],
  options?: { rootMargin?: string },
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  const idsKey = sectionIds.join(",");
  const rootMargin = options?.rootMargin ?? DEFAULT_ROOT_MARGIN;

  useEffect(() => {
    if (!idsKey) return;

    const ids = idsKey.split(",").filter(Boolean);
    if (ids.length === 0) return;

    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let best: string | null = null;
        let bestRatio = 0;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            best = entry.target.id;
            bestRatio = entry.intersectionRatio;
          }
        }

        if (best !== null) {
          setActiveId(best);
        }
      },
      {
        rootMargin,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    const elements: Element[] = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        elements.push(el);
      }
    }

    return () => {
      for (const el of elements) {
        observer.unobserve(el);
      }
      observer.disconnect();
    };
  }, [idsKey, rootMargin]);

  return activeId;
}
