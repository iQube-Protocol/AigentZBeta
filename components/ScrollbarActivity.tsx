'use client';

import { useEffect } from 'react';

/**
 * Toggles `is-scrolling` on <html> while any scrollable element (window or a
 * nested overflow container, e.g. the side menu) is actively being scrolled,
 * clearing it after a short idle debounce. Scroll events on nested elements
 * don't bubble, so the listener is attached in the CAPTURE phase on window to
 * catch every descendant's scroll — a single global toggle drives the CSS
 * fade in globals.css (dormant = transparent, active = slate) instead of a
 * per-element listener.
 */
export default function ScrollbarActivity() {
  useEffect(() => {
    const root = document.documentElement;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const onScroll = () => {
      root.classList.add('is-scrolling');
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => root.classList.remove('is-scrolling'), 650);
    };

    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
      if (idleTimer) clearTimeout(idleTimer);
      root.classList.remove('is-scrolling');
    };
  }, []);

  return null;
}
