// src/hooks/useDocumentTitle.ts
import { useEffect } from 'react';

/**
 * Hook to set the document title and optionally a meta description.
 *
 * @param title - The title to set for the page (will appear in the browser tab).
 * @param description - Optional meta description content. If omitted, the existing
 *   description meta tag will not be modified.
 */
export const useDocumentTitle = (title: string, description?: string): void => {
  // Using React's useEffect ensures the side‑effects run after render and are
  // cleaned up/rerun when the dependencies change.
  useEffect(() => {
    // Update the document title.
    document.title = title;

    // Update (or create) the meta description when a description is provided.
    if (typeof description === 'string') {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
  }, [title, description]);
};
