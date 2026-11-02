import { Card, CardContent, CardHeader, CardTitle } from '@flama/design-system-web';
import { useAccounts } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { useTranslation } from 'react-i18next';
import { AccountIdentity } from '../components/account-identity';
import { formatPercent, formatResetIn } from '../lib/format';
import { attentionItems } from '../lib/insights';

/** The accounts that want something from you now, most urgent first. */
export function NeedsAttention() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const { data: accounts = [] } = useAccounts();
  const items = attentionItems(accounts, new Date(now)).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('accounts.attention.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border-subtle">
        {items.length === 0 && (
          <p className="py-3 text-sm text-ink-600">{t('accounts.attention.empty')}</p>
        )}
        {items.map(({ account, pace, kind }) => (
          <div key={account.id} className="flex items-center justify-between gap-4 py-3">
            <AccountIdentity account={account} />
            <div className="text-right text-sm">
              <div className="font-medium text-ink-900">{t(`accounts.attention.${kind}`)}</div>
              <div className="text-ink-600">
                {kind === 'signin'
                  ? (account.latest?.message ?? t('accounts.attention.signinHint'))
                  : t('accounts.attention.detail', {
                      left: formatPercent(pace.left),
                      reset: formatResetIn(pace.weeklyResetsAt, now, locale) ?? '—',
                    })}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
