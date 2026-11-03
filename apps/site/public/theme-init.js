// Apply the theme before first paint, so the prerendered page never flashes
// the wrong one. A stored choice wins; otherwise the system's, and dark when
// the system has none — the design's default.
//
// A file rather than an inline block in index.html because the site is served
// under `script-src 'self'` (apps/site/nginx.conf), the same reasoning as
// apps/web/public/theme-init.js.
(() => {
  let theme = 'dark';
  try {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') theme = stored;
    else if (matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
  } catch {}
  document.documentElement.classList.add(theme);
})();
