import { Moon, Sun } from '@flama/design-system-web/icons';

/**
 * Flips the theme `public/theme-init.js` applied and remembers the choice.
 *
 * It holds no state: both icons are drawn and the theme class on `<html>`
 * picks one (`.site-theme-toggle` in `styles.css`), so the prerendered markup
 * and the hydrated tree are the same whichever theme the visitor has.
 */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.classList.contains('light') ? 'dark' : 'light';
    root.classList.remove('light', 'dark');
    root.classList.add(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Storage blocked: the switch still applies for this visit.
    }
  };
  return (
    <button
      type="button"
      className="ds-btn ds-btn--sm ds-btn--ghost site-theme-toggle"
      aria-label="Switch between light and dark theme"
      onClick={toggle}
    >
      <Moon className="site-theme-toggle__moon" size={18} aria-hidden="true" />
      <Sun className="site-theme-toggle__sun" size={18} aria-hidden="true" />
    </button>
  );
}
