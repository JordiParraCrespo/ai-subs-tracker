import { ToggleGroup, ToggleGroupItem } from '@flama/design-system-web';
import { PageHead } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { USAGE_PERIODS, type UsagePeriod } from '../lib/periods';
import { ModelUsage } from '../sections/model-usage';
import { PlanValue } from '../sections/plan-value';
import { UsageHeadline } from '../sections/usage-headline';

/** Tokens across every account, and what the plans returned at API prices. */
export function UsageScreen({
  days,
  onDaysChange,
}: {
  days: UsagePeriod;
  onDaysChange: (days: UsagePeriod) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <PageHead
        title={t('accounts.usage.title')}
        sub={t('accounts.usage.sub', { days })}
        action={
          <ToggleGroup
            value={[String(days)]}
            onValueChange={(next) => {
              const picked = Number(next[0]);
              if (USAGE_PERIODS.includes(picked as UsagePeriod))
                onDaysChange(picked as UsagePeriod);
            }}
          >
            {USAGE_PERIODS.map((period) => (
              <ToggleGroupItem key={period} value={String(period)}>
                {t('accounts.usage.period', { days: period })}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      <UsageHeadline days={days} />
      <PlanValue days={days} />
      <ModelUsage days={days} />
    </>
  );
}
