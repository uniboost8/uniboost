/* Sets the saved color theme before the page paints, and handles the Light / Dark switch. */
(function () {
  try {
    var t = localStorage.getItem('ub-theme');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
  if (window.__ubTheme) return;
  window.__ubTheme = true;
  document.addEventListener('click', function (e) {
    var theme = e.target.closest && e.target.closest('[data-set-theme]');
    if (!theme) return;
    var next = theme.getAttribute('data-set-theme');
    if (next !== 'light' && next !== 'dark') return;
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ub-theme', next); } catch (err) {}
    document.dispatchEvent(new Event('ub-theme'));
  });
})();
