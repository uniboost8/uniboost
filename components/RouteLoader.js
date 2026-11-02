'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const CLEAN = {
  '/index.html': '/',
  '/instructors.html': '/instructors',
  '/courses.html': '/courses',
  '/schedule.html': '/schedule',
  '/my-classes.html': '/my-classes',
  '/recordings.html': '/recordings',
  '/dashboard.html': '/dashboard',
  '/privacy.html': '/privacy'
};

function destination(url) {
  let path = CLEAN[url.pathname] || url.pathname;
  let search = url.search;
  if (url.pathname === '/instructor.html') {
    const id = url.searchParams.get('id');
    path = id ? '/instructors/' + encodeURIComponent(id) : '/instructors';
    const slot = url.searchParams.get('slot');
    search = slot ? '?slot=' + encodeURIComponent(slot) : '';
  }
  return path + search;
}

export function RouteLoader() {
  const router = useRouter();
  const [on, setOn] = useState(false);
  const started = useRef(0);
  const pending = useRef('');

  useEffect(() => {
    const go = (href) => {
      pending.current = href;
      started.current = performance.now();
      document.body.classList.remove('menu-open');
      setOn(true);
      router.push(href);
    };
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.hasAttribute('download')) return;
      if (a.target && a.target !== '_self') return;
      const raw = a.getAttribute('href');
      if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(raw)) return;
      let url;
      try { url = new URL(raw, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      const next = destination(url);
      const here = location.pathname + location.search;
      if (next === here || next === here + '/' || next + '/' === here) {
        if (!url.hash) e.preventDefault();
        return;
      }
      e.preventDefault();
      go(next + url.hash);
    };
    const onPop = () => {
      pending.current = location.pathname + location.search;
      started.current = performance.now();
      setOn(true);
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
    };
  }, [router]);

  useEffect(() => {
    if (!on) return;
    let stop = false;
    const tick = () => {
      if (stop) return;
      const here = location.pathname + location.search;
      const want = pending.current.split('#')[0];
      const arrived = !want || want === here || want === here + '/' || want + '/' === here;
      if (arrived && performance.now() - started.current >= 520) {
        setOn(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    const safety = setTimeout(() => setOn(false), 8000);
    return () => {
      stop = true;
      cancelAnimationFrame(frame);
      clearTimeout(safety);
    };
  }, [on]);

  return (
    <>
      <div className={'ub-progress' + (on ? ' on' : '')} aria-hidden="true"><span></span></div>
      <div className={'route-loader' + (on ? ' on' : '')} role="status" aria-live="polite" aria-hidden={on ? 'false' : 'true'}>
        <div className="route-loader-card">
          <div className="route-loader-mark" aria-hidden="true"><span className="orbit"></span><i>U</i></div>
          <p className="route-loader-name">Uni Boost</p>
          <p className="route-loader-sub">Preparing your page</p>
        </div>
      </div>
    </>
  );
}
