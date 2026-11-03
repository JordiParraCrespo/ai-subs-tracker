import { links } from '../lib/links';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="ds-container site-footer__bar">
        <span className="site-footer__brand">Subtrack</span>
        <nav className="site-footer__links" aria-label="Footer">
          <a href={links.source} className="site-link">
            Source
          </a>
          <a href={links.download} className="site-link">
            Releases
          </a>
          <a href={links.signIn} className="site-link">
            Sign in
          </a>
        </nav>
        <span>© 2026 Subtrack · MIT licensed</span>
      </div>
    </footer>
  );
}
