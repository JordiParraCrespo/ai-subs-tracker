import { Download } from '@flama/design-system-web/icons';
import { ButtonLink } from '../components/button-link';
import { links } from '../lib/links';

export function Hero() {
  return (
    <section id="top" className="ds-container site-hero">
      <h1 className="site-hero__title">Use up the AI coding plans you pay for</h1>
      <p className="site-hero__lede">
        Subtrack watches every Claude Code and Codex login on your computer, shows what each plan’s
        5-hour and weekly limits have left, and tells you which account to use next.
      </p>
      <div className="site-hero__actions">
        <ButtonLink
          href={links.download}
          variant="primary"
          size="lg"
          icon={<Download size={18} aria-hidden="true" />}
        >
          Download for desktop
        </ButtonLink>
        <ButtonLink href="#how" size="lg">
          How it works
        </ButtonLink>
      </div>
      <span className="site-note">Free and open source. macOS, Windows and Linux.</span>
    </section>
  );
}
