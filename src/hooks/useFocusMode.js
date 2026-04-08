import { useState } from 'react';

const KEY = 'belori_focus_mode';

export function useFocusMode() {
  const [focusMode, setFocusMode] = useState(() => {
    try { return localStorage.getItem(KEY) === 'true'; } catch { return false; }
  });

  const toggle = () => {
    setFocusMode(prev => {
      const next = !prev;
      try { localStorage.setItem(KEY, String(next)); } catch {}
      return next;
    });
  };

  return { focusMode, toggle };
}
