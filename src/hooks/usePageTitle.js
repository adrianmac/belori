import { useEffect } from 'react';

// Sets document.title for the lifetime of the calling component, then
// restores the previous title on unmount.
//
// Format is "<page> · Belori" so the brand stays in tabs and bookmarks
// without dominating. Pass a falsy value to skip the effect entirely
// (useful when the page title depends on async-loaded data).
//
// Example:
//   usePageTitle('Events');                          // "Events · Belori"
//   usePageTitle(client && `${client.name}`);        // skips until name loads
//
// Why this and not <Helmet> / react-helmet-async:
// document.title is one global string — there's no need for the
// portal-based <head> management Helmet provides for SSR. We're a
// client-side SPA, the simplest correct thing wins.

const SUFFIX = 'Belori';

export function usePageTitle(title) {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = `${title} · ${SUFFIX}`;
    return () => {
      // Only restore if no one else changed the title in the meantime
      // (guards against the rare case of two pages briefly mounted at once).
      if (document.title === `${title} · ${SUFFIX}`) {
        document.title = prev;
      }
    };
  }, [title]);
}

export default usePageTitle;
