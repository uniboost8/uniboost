'use client';

import { useEffect } from 'react';

export function Providers({ children }) {
  useEffect(() => {
    let live = true;
    (async () => {
      window.__NEXT = true;
      window.UCC_CONFIG = {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
        preview: process.env.NEXT_PUBLIC_PREVIEW === '1'
      };
      await import('../safe.js');
      await import('../data.js');
      await import('../site-ui.js');
      await import('../pages.js');
      await import('../dashboard.js');
      if (!live) return;
      document.dispatchEvent(new Event('ub-ready'));
    })().catch(err => {
      console.error(err);
      if (live) document.body.insertAdjacentHTML('afterbegin', '<div class="warn" style="margin:0;border-radius:0;text-align:center">Could not start the app. Reload the page.</div>');
    });
    return () => { live = false; };
  }, []);
  return children;
}
