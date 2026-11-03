import { DsCard } from '@flama/design-system-web';
import { Check, Minus } from '@flama/design-system-web/icons';
import { reachesApi, staysLocal } from '../lib/content';

/**
 * What the design drew as pricing. Subtrack has no paid tier to sell, and the
 * question a careful buyer of several AI plans asks is where their logins go,
 * so the two cards answer that, from the README's "What it never does".
 */
export function Privacy() {
  return (
    <section id="privacy" className="ds-container site-section">
      <div className="site-section__head">
        <span className="site-eyebrow">Privacy</span>
        <h2 className="site-h2">Your logins never leave your computer</h2>
        <p className="site-muted m-0">
          Subtrack never refreshes a provider’s token, talks to each provider as itself
          (subtrack-desktop), and never replaces a status line you already have.
        </p>
      </div>
      <div className="site-grid site-grid--wide">
        <div className="site-featured">
          <DsCard>
            <div className="site-plan">
              <div className="site-plan__head">
                <h3 className="site-plan__title">Stays on your computer</h3>
                <span className="site-pill">Never sent</span>
              </div>
              <ul className="site-checklist">
                {staysLocal.map((item) => (
                  <li key={item}>
                    <Check size={16} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </DsCard>
        </div>
        <DsCard>
          <div className="site-plan">
            <div className="site-plan__head">
              <h3 className="site-plan__title">Reaches Subtrack</h3>
            </div>
            <ul className="site-checklist site-checklist--muted">
              {reachesApi.map((item) => (
                <li key={item}>
                  <Minus size={16} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </DsCard>
      </div>
    </section>
  );
}
