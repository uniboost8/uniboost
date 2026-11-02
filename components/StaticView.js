'use client';

import { useEffect, useRef } from 'react';

const REQ = { instructors: 'course', courses: 'course', schedule: 'class' };

export function StaticView({ html, page, deps = '' }) {
  const host = useRef(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const key = page + '\n' + deps;
    if (el.dataset.key !== key) {
      el.innerHTML = html;
      el.dataset.key = key;
    }
    const boot = () => {
      if (!window.UCC_PAGES || !window.UCC_PAGES[page]) return;
      window.UCC_PAGES[page]();
      const kind = REQ[page];
      const btn = el.querySelector('#reqbar button');
      if (kind && btn) btn.onclick = () => window.requestForm(kind);
      if (window.observeReveal) window.observeReveal(document);
    };
    if (window.UCC_PAGES) boot();
    else document.addEventListener('ub-ready', boot);
    return () => document.removeEventListener('ub-ready', boot);
  }, [html, page, deps]);
  return <div ref={host} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
