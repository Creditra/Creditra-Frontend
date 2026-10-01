import { useEffect } from 'react';

export const useDocumentTitle = (title: string, description?: string): void => {
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
