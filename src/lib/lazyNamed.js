import { lazy } from 'react';

const RELOAD_KEY = 'crm_chunk_reload_at';

/**
 * React.lazy for a named export: lazyNamed(() => import('./X'), 'X').
 *
 * After a deploy the old build's files are gone, so a tab left open on the old version fails to load
 * a screen it has not opened yet. The page then reloads once to pick up the new build (at most once a
 * minute, so a real network failure shows the error instead of reloading in a loop).
 */
export const lazyNamed = (loader, name) => lazy(() => loader().then(
  (mod) => ({ default: mod[name] }),
  (err) => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch { /* no storage */ }
    if (Date.now() - last > 60_000) {
      try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* no storage */ }
      window.location.reload();
      return new Promise(() => {}); // keep showing the loading state until the reload happens
    }
    throw err;
  }
));
