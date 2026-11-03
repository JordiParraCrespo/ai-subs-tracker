import { DsCard } from '@flama/design-system-web';
import { FeatureIcon } from '../components/feature-icon';
import { features } from '../lib/content';

export function Features() {
  return (
    <section id="features" className="ds-container site-section">
      <div className="site-section__head">
        <span className="site-eyebrow">Features</span>
        <h2 className="site-h2">Know what every plan has left, and which one to use</h2>
      </div>
      <div className="site-grid">
        {features.map((feature) => (
          <DsCard key={feature.title}>
            <div className="site-feature">
              <FeatureIcon name={feature.icon} />
              <div className="site-feature__body">
                <h3 className="site-feature__title">{feature.title}</h3>
                <p className="site-muted m-0">{feature.text}</p>
              </div>
            </div>
          </DsCard>
        ))}
      </div>
    </section>
  );
}
