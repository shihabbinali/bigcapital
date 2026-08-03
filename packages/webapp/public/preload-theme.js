const THEME_STORAGE_KEY = 'theme';

// Resolve theme: stored preference -> OS prefers-color-scheme -> light.
const resolveTheme = () => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch (_) {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const theme = resolveTheme();

// Single source of truth: `data-theme` on <html> drives CSS custom properties.
document.documentElement.dataset.theme = theme;

// Blueprint v4 portals (dialogs/drawers/toasts) render into <body>, so the
// dark class must be kept in sync on BOTH <html> and <body>.
const applyDark = theme === 'dark';
[document.documentElement, document.body].forEach((el) => {
  el.classList.toggle('bp4-dark', applyDark);
});

// Payment portal pages are always light.
if (window.location.pathname.startsWith('/payment')) {
  document.documentElement.dataset.theme = 'light';
  document.documentElement.classList.remove('bp4-dark');
  document.body.classList.remove('bp4-dark');
}
