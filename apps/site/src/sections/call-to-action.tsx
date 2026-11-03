import { ArrowRight } from '@flama/design-system-web/icons';
import { links } from '../lib/links';

export function CallToAction() {
  return (
    <section className="ds-container pb-24">
      <div className="site-band">
        <div className="site-band__text">
          <h2 className="site-band__title">Stop leaving paid limits on the table</h2>
          <span className="site-band__lede">
            Install Subtrack and see which of your accounts to use next in under a minute.
          </span>
        </div>
        <a href={links.download} className="site-band__cta">
          Download Subtrack
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
