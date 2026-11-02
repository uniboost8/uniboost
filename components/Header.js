'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const LINKS = [
  ['Home', '/'],
  ['Instructors', '/instructors'],
  ['Courses', '/courses'],
  ['Schedule', '/schedule'],
  ['My Classes', '/my-classes'],
  ['Recordings', '/recordings'],
  ['Dashboard', '/dashboard']
];

function onPath(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

function ThemeSwitch() {
  return (
    <div className="theme-switch" role="group" aria-label="Color theme">
      <button type="button" data-set-theme="light">Light</button>
      <button type="button" data-set-theme="dark">Dark</button>
    </div>
  );
}

export function Header() {
  const pathname = usePathname() || '/';
  useEffect(() => {
    document.body.classList.remove('menu-open');
    document.body.classList.add('menu-ready');
  }, [pathname]);
  return (
    <>
      <header>
        <div className="wrap nav">
          <a href="/" className="logo"><i>U</i>Uni Boost</a>
          <nav className="nav-links" aria-label="Primary">
            {LINKS.map(([label, href]) => (
              <a key={href} href={href} aria-current={onPath(pathname, href) ? 'page' : undefined}>{label}</a>
            ))}
          </nav>
          <div className="nav-right">
            <ThemeSwitch />
            <a className="btn btn-primary btn-sm nav-book" href="/schedule">Book a class</a>
            <button className="burger" type="button" aria-label="Menu" aria-expanded="false"><span></span></button>
          </div>
        </div>
      </header>
      <div className="menu" id="menu">
        <div className="wrap">
          {LINKS.map(([label, href]) => (
            <a className="item" key={href} href={href} style={onPath(pathname, href) ? { color: 'var(--accent2)' } : undefined}>{label}</a>
          ))}
          <a className="btn btn-primary menu-book" href="/schedule">Book a class</a>
          <ThemeSwitch />
        </div>
      </div>
    </>
  );
}
