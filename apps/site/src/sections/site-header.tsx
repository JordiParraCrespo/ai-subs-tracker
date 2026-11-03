import { ButtonLink } from '../components/button-link';
import { ThemeToggle } from '../components/theme-toggle';
import { links } from '../lib/links';

export const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#privacy', label: 'Privacy' },
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="ds-container site-header__bar">
        <a href="#top" className="site-brand">
          Subtrack
        </a>
        <nav className="site-nav" aria-label="Sections">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="site-link">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="site-header__actions">
          <ThemeToggle />
          <ButtonLink href={links.signIn} variant="ghost" size="sm" className="site-header__signin">
            Sign in
          </ButtonLink>
          <ButtonLink href={links.download} variant="primary" size="sm">
            Download
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
