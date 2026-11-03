import { DsButton, DsCard, DsCardHeader } from '@flama/design-system-web';
import { ArrowRightLeft, Hourglass } from '@flama/design-system-web/icons';
import { useAccounts } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { useTranslation } from 'react-i18next';
import { useResetIn } from '../hooks/use-reset-in';
import { useSwitchAccount } from '../hooks/use-switch-account';
import { formatMoney } from '../lib/format';
import { tokenmaxxRows } from '../lib/tokenmaxx-model';

/** The design's "Moves to max out this week": what would otherwise go unused, and where to move work. */
export function TokenmaxxMoves() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const { data: accounts = [] } = useAccounts();
  const switcher = useSwitchAccount();
  const rows = tokenmaxxRows(accounts, new Date(now));
  const under = rows.filter((row) => row.status === 'under' || row.status === 'expiring');
  const hot = rows.filter((row) => row.status === 'hot' || row.status === 'limit');
  const hours = useResetIn();

  const tips = [
    ...under.slice(0, 2).map((row) => ({
      key: `under-${row.account.id}`,
      icon: <Hourglass className="size-4.5" strokeWidth={1.5} />,
      title: t('accounts.tm.moves.wasteTitle', { name: row.name, waste: Math.round(row.waste) }),
      sub: t('accounts.tm.moves.wasteSub', {
        when: hours(row.hours),
        value: formatMoney(row.wasteCents, locale),
      }),
      action: row.account.isActive ? null : () => switcher.switchTo(row.account),
    })),
    ...hot.slice(0, 1).map((row) => ({
      key: `hot-${row.account.id}`,
      icon: <ArrowRightLeft className="size-4.5" strokeWidth={1.5} />,
      title:
        row.status === 'limit'
          ? t('accounts.tm.moves.limitTitle', { name: row.name })
          : t('accounts.tm.moves.hotTitle', { name: row.name }),
      sub: under[0]
        ? t('accounts.tm.moves.hotSub', { other: under[0].name, when: hours(row.hours) })
        : t('accounts.tm.moves.hotSubAlone', { when: hours(row.hours) }),
      action: null,
    })),
  ];

  return (
    <DsCard>
      <DsCardHeader title={t('accounts.tm.moves.title')} />
      {tips.map((tip) => (
        <div
          key={tip.key}
          className="flex items-center gap-3 border-t border-border-default px-6 py-3.5"
        >
          <span className="ds-disc size-9">{tip.icon}</span>
          <div className="ds-row__txt">
            <span className="ds-label-strong whitespace-normal">{tip.title}</span>
            <span className="ds-t-sub whitespace-normal">{tip.sub}</span>
          </div>
          {tip.action && (
            <DsButton size="xs" onClick={tip.action}>
              {t('accounts.group.use')}
            </DsButton>
          )}
        </div>
      ))}
      {tips.length === 0 && (
        <p className="border-t border-border-default px-6 py-4 text-sm text-ink-600">
          {t('accounts.tm.moves.none')}
        </p>
      )}
    </DsCard>
  );
}
