import { steps } from '../lib/content';

export function HowItWorks() {
  return (
    <section id="how" className="ds-container site-section">
      <div className="site-section__head">
        <span className="site-eyebrow">How it works</span>
        <h2 className="site-h2">Set up in a minute</h2>
      </div>
      <ol className="site-steps">
        {steps.map((step) => (
          <li key={step.n} className="site-step">
            <span className="site-step__n" aria-hidden="true">
              {step.n}
            </span>
            <h3 className="site-step__title">{step.title}</h3>
            <p className="site-muted m-0">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
