import './globals.css';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { Providers } from '../components/Providers';
import { RouteLoader } from '../components/RouteLoader';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export const metadata = {
  title: 'Uni Boost',
  description: 'Browse instructor profiles, view active promotions, and book your exact date and time for virtual classes in Giza.'
};

const BOOT = `(function(){
  try {
    var t = localStorage.getItem('ub-theme');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
  if (window.__ubTheme) return;
  window.__ubTheme = true;
  document.addEventListener('click', function (e) {
    var theme = e.target.closest && e.target.closest('[data-set-theme]');
    if (theme) {
      var next = theme.getAttribute('data-set-theme');
      if (next === 'light' || next === 'dark') {
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('ub-theme', next); } catch (err) {}
        document.dispatchEvent(new Event('ub-theme'));
      }
      return;
    }
    if (e.target.closest && e.target.closest('.burger')) {
      var open = document.body.classList.toggle('menu-open');
      var b = document.querySelector('.burger');
      if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if (e.target.closest && e.target.closest('#menu a')) document.body.classList.remove('menu-open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') document.body.classList.remove('menu-open');
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth >= 1080) document.body.classList.remove('menu-open');
  });
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <style dangerouslySetInnerHTML={{ __html: '.menu{position:fixed;top:68px;left:0;right:0;transform:translateY(-120%);opacity:0;visibility:hidden;pointer-events:none}body.menu-open .menu{transform:none;opacity:1;visibility:visible;pointer-events:auto}' }} />
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
        <Providers>
          <Header />
          <RouteLoader />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
