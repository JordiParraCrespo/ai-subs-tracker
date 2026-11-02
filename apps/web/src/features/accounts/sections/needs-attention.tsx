import { DsAvatar, DsButton, DsCard, DsCardHeader, DsCardRow } from '@flama/design-system-web';
import { useAccounts } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney, formatPercent, formatResetIn } from '../lib/format';
import { attentionItems, wastedLastMonthCents } from '../lib/insights';
import { accountMark, accountTitle } from '../lib/marks';

const SHOWN = 4;

/** The design's "Needs attention" card: what wants something from you now, and what it saves. */
export function NeedsAttention() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const [all, setAll] = useState(false);
  const { data: accounts = [] } = useAccounts();
  const items = attentionItems(accounts, new Date(now));
  const shown = all ? items : items.slice(0, SHOWN);

  return (
    <DsCard>
      <DsCardHeader
        title={t('accounts.attention.title')}
        action={
          <span className="text-sm text-data-up">
            {t('accounts.attention.toSave', {
              value: formatMoney(wastedLastMonthCents(accounts), locale),
            })}
          </span>
        }
      />
      {shown.map(({ account, pace, kind }) => {
        const mark = accountMark(account);
        const weeklyValue = (account.monthlyPriceCents * 7) / 30.44;
        return (
          <Link key={account.id} to="/tokenmaxx" className="contents">
            <DsCardRow
              leading={<DsAvatar initials={mark.initials} color={mark.color} size={32} />}
              title={t(`accounts.attention.${kind}Title`, { name: accountTitle(account) })}
              subtitle={
                kind === 'signin'
                  ? account.displayName
                  : t('accounts.attention.detail', {
                      left: formatPercent(pace.left),
                      reset: formatResetIn(pace.weeklyResetsAt, now, locale) ?? '—',
                    })
              }
              value={
                kind === 'signin' || pace.left === null
                  ? '—'
                  : formatMoney((pace.left / 100) * weeklyValue, locale)
              }
              subvalue={t(`accounts.attention.${kind}End`)}
            />
          </Link>
        );
      })}
      {items.length === 0 && (
        <p className="border-t border-border-default px-6 py-4 text-sm text-ink-600">
          {t('accounts.attention.empty')}
        </p>
      )}
      {items.length > SHOWN && (
        <div className="border-t border-border-default px-4 py-2.5">
          <DsButton size="text" onClick={() => setAll((was) => !was)}>
            {all
              ? t('accounts.attention.showLess')
              : t('accounts.attention.showAll', { count: items.length })}
          </DsButton>
        </div>
      )}
    </DsCard>
  );
}
