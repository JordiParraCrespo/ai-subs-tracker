import { Card, CardContent, Skeleton } from '@flama/design-system-web';
import { useAccounts, useUsageSummary } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { AreaChart } from '../components/area-chart';
import { Stat } from '../components/stat';
import { formatCompact, formatMoney } from '../lib/format';
import { monthlySpendCents } from '../lib/insights';

/**
 * Tokens over the period, what they would have cost at API prices, and what
 * the plans cost for the same days.
 */
export function UsageHeadline({ days }: { days: number }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const usage = useUsageSummary(days);
  const accounts = useAccounts();

  if (!usage.data || !accounts.data) return <Skeleton className="mb-8 h-72 w-full" />;
  const { totals, daily } = usage.data;
  const tokens = totals.input + totals.output + totals.cacheWrite + totals.cacheRead;
  const paid = (monthlySpendCents(accounts.data) * days) / 30.44;
  const ratio = paid > 0 ? totals.apiCostCents / paid : null;

  return (
    <Card className="mb-8">
      <CardContent className="flex flex-col gap-8 py-2">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat label={t('accounts.usage.tokens')} value={formatCompact(tokens, locale)} />
          <Stat
            label={t('accounts.usage.messages')}
            value={formatCompact(totals.messages, locale)}
          />
          <Stat
            label={t('accounts.usage.apiValue')}
            value={formatMoney(totals.apiCostCents, locale)}
            hint={t('accounts.usage.paid', { value: formatMoney(paid, locale) })}
          />
          {ratio !== null && (
            <Stat label={t('accounts.overview.valuePerDollar')} value={`${ratio.toFixed(1)}×`} />
          )}
        </div>
        <div>
          <div className="text-sm text-ink-600">{t('accounts.usage.dailyValue')}</div>
          <AreaChart
            values={daily.map((day) => day.apiCostCents)}
            label={t('accounts.usage.dailyValue')}
          />
          {daily.length < 2 && (
            <p className="py-6 text-sm text-ink-600">{t('accounts.usage.notEnough')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
