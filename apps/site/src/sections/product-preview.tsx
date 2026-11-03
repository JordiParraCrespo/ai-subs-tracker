import {
  DsAreaChart,
  DsAvatar,
  DsCard,
  DsCardHeader,
  DsCardRow,
  DsStatGrid,
} from '@flama/design-system-web';
import { apiValue, apiValueLabels, formatDollars, previewStats, useNext } from '../lib/content';

/** The Overview and Tokenmaxx screens in miniature, on example figures. */
export function ProductPreview() {
  return (
    <section className="ds-container site-section" aria-label="Example of the Subtrack screens">
      <figure className="m-0">
        <div className="site-frame">
          <div className="site-frame__grid">
            <DsCard>
              <div className="site-frame__chart">
                <DsAreaChart
                  title="Usage at API prices"
                  data={apiValue}
                  labels={apiValueLabels}
                  formatValue={formatDollars}
                  restLabel="Past 12 months"
                />
                <div className="site-frame__stats">
                  <DsStatGrid items={previewStats} columns={3} />
                </div>
              </div>
            </DsCard>
            <DsCard>
              <DsCardHeader
                title="Use next"
                action={<span className="site-positive">Most headroom first</span>}
              />
              {useNext.map((account) => (
                <DsCardRow
                  key={account.title}
                  leading={<DsAvatar initials={account.initials} color={account.color} size={32} />}
                  title={account.title}
                  subtitle={account.subtitle}
                  value={account.value}
                  subvalue="left"
                />
              ))}
            </DsCard>
          </div>
        </div>
        <figcaption className="site-note site-frame__caption">
          Example figures. Plans and prices are the providers’ own.
        </figcaption>
      </figure>
    </section>
  );
}
