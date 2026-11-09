import { DsBadge, DsButton, DsCard, DsStatusBadge, Skeleton } from '@flama/design-system-web';
import { ArrowRightLeft, TrendingUp } from '@flama/design-system-web/icons';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useAccounts } from '@flama/frontend-consumer/react';
import { dateFormatter, useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { isManualProvider, type ProviderId } from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditAccountDialog } from '../dialogs/edit-account';
import { ReadUsageDialog } from '../dialogs/read-usage';
import { RecordUsageDialog } from '../dialogs/record-usage';
import { RemoveAccountDialog } from '../dialogs/remove-account';
import { useDesktopStatus } from '../hooks/use-desktop-status';
import { useSwitchAccount } from '../hooks/use-switch-account';
import { formatPercent, isWeeklyOnly } from '../lib/format';
import { providerGroup } from '../lib/provider-group';
import { PROVIDER_NAMES } from '../lib/providers';

type Dialog = { kind: 'edit' | 'remove' | 'record' | 'read'; account: AccountEntity } | null;

/**
 * The design's shared-accounts page for one provider: the account to pick
 * next, how evenly the week is spread, a card per account with the average
 * marked on its bar, and the moves that would help. A provider tracked by
 * hand (Z.AI, BigModel) has no terminal to switch: each card records usage
 * instead, and turns on the desktop app's unofficial reader where there is one.
 */
export function ProviderAccounts({ provider }: { provider: ProviderId }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const accounts = useAccounts();
  const switcher = useSwitchAccount();
  const desktop = useDesktopStatus();
  const [dialog, setDialog] = useState<Dialog>(null);

  /** The reader's state as a button: off, on, or failing (null: kept, not tried yet). */
  const readerLabel = (status: string | null | undefined) =>
    status === undefined
      ? t('accounts.group.readerOff')
      : status === 'ok' || status === null
        ? t('accounts.group.readerOn')
        : t('accounts.group.readerFailing');

  if (!accounts.data) return <Skeleton className="h-96 w-full" />;
  const mine = accounts.data.filter((account) => account.provider === provider);
  const group = providerGroup(mine, new Date(now));
  const resetAt = dateFormatter(locale, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const reset = (iso: string | null) => (iso ? resetAt.format(new Date(iso)) : '—');
  const avgLeft = `${Math.round(group.average ?? 0)}%`;

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-4">
        <div className="ds-card ds-card--promo flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-6">
          <span className="ds-eyebrow opacity-80">{t('accounts.group.pickNext')}</span>
          {group.pick ? (
            <>
              <div className="flex items-baseline gap-3">
                <span className="ds-title-lg">{group.pick.account.displayName}</span>
                <span className="ds-body-lg">
                  {t('accounts.group.used', { used: formatPercent(group.pick.pace.weeklyUsed) })}
                </span>
              </div>
              <span className="ds-text-label">
                {t('accounts.group.headroom', {
                  left: formatPercent(group.pick.pace.left),
                  reset: reset(group.pick.pace.weeklyResetsAt),
                })}
              </span>
            </>
          ) : (
            <span className="ds-text-label">{t('accounts.tokenmaxx.nothingUsable')}</span>
          )}
        </div>
        <DsCard className="flex min-w-0 flex-[2_1_420px] flex-col justify-center gap-2 p-6">
          <span className="ds-text-label ds-muted">{t('accounts.group.weeklyTitle')}</span>
          <span className="ds-card-title">
            {group.busiest
              ? t('accounts.group.busiest', {
                  name: group.busiest.account.displayName,
                  used: formatPercent(group.busiest.pace.weeklyUsed),
                  average: formatPercent(group.average),
                })
              : '—'}
          </span>
          <span className="ds-text-label ds-muted">{t('accounts.group.weeklyHint')}</span>
        </DsCard>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {group.cards.map(({ account, pace }) => {
          const used = pace.weeklyUsed ?? 0;
          const isNext = group.pick?.account.id === account.id;
          return (
            <DsCard key={account.id} className="flex flex-col gap-3.5 p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="ds-label-strong truncate">{account.displayName}</span>
                {isNext && <DsStatusBadge>{t('accounts.group.next')}</DsStatusBadge>}
              </div>
              <span className="ds-title-lg">{formatPercent(pace.weeklyUsed)}</span>
              <div className="ds-meter">
                <div
                  className="ds-meter__fill"
                  data-hot={used >= 90 ? '' : undefined}
                  // oxlint-disable-next-line no-inline-styles -- the fill is the reading
                  style={{ width: `${Math.min(100, used)}%` }}
                />
                {/* oxlint-disable-next-line no-inline-styles -- the average is data */}
                <div className="ds-meter__mark" style={{ left: avgLeft }} />
              </div>
              <span className="ds-t-sub">
                {account.planName ?? '—'} ·{' '}
                {t('accounts.group.resets', { at: reset(pace.weeklyResetsAt) })}
              </span>
              {account.readUnofficially && (
                <span className="ds-t-sub">
                  {t('accounts.group.readUnofficially', { name: PROVIDER_NAMES[account.provider] })}
                </span>
              )}
              {account.reportedPlanMismatch && (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1">
                    <DsBadge tone="review">
                      {t('accounts.group.planReported', {
                        name: PROVIDER_NAMES[account.provider],
                        plan: account.reportedPlanMismatch.name,
                      })}
                    </DsBadge>
                  </span>
                  <DsButton size="text" onClick={() => setDialog({ kind: 'edit', account })}>
                    {t('accounts.group.planReview')}
                  </DsButton>
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-border-default pt-3">
                <div className="flex items-center gap-2">
                  <span className="ds-text-label min-w-0 flex-1 truncate">
                    {t('accounts.table.session')}
                  </span>
                  <span className="ds-text-label ds-muted">
                    {isWeeklyOnly(pace)
                      ? t('accounts.table.noSession')
                      : formatPercent(pace.sessionUsed)}
                  </span>
                </div>
                {account.isManual ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="ds-text-label min-w-0 flex-1 truncate">
                        {t('accounts.group.usage')}
                      </span>
                      <DsButton size="text" onClick={() => setDialog({ kind: 'record', account })}>
                        {t('accounts.group.record')}
                      </DsButton>
                    </div>
                    {account.hasUnofficialReader && (
                      <div className="flex items-center gap-2">
                        <span className="ds-text-label min-w-0 flex-1 truncate">
                          {t('accounts.group.automatic')}
                        </span>
                        <DsButton size="text" onClick={() => setDialog({ kind: 'read', account })}>
                          {readerLabel(
                            desktop?.readers.find((r) => r.accountId === account.id)?.status,
                          )}
                        </DsButton>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="ds-text-label min-w-0 flex-1 truncate">
                      {t('accounts.group.terminals')}
                    </span>
                    {account.isActive ? (
                      <span className="ds-text-label ds-muted">{t('accounts.group.inUse')}</span>
                    ) : (
                      <DsButton size="text" onClick={() => switcher.switchTo(account)}>
                        {t('accounts.group.use')}
                      </DsButton>
                    )}
                  </div>
                )}
                <div className="flex gap-1">
                  <DsButton size="text" onClick={() => setDialog({ kind: 'edit', account })}>
                    {t('accounts.table.edit')}
                  </DsButton>
                  <DsButton size="text" onClick={() => setDialog({ kind: 'remove', account })}>
                    {t('accounts.table.remove')}
                  </DsButton>
                </div>
              </div>
            </DsCard>
          );
        })}
      </div>

      <div className="ds-card ds-card--list overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="ds-card-header__title">{t('accounts.group.moves')}</h2>
        </div>
        {group.pick && !group.pick.account.isActive && !group.pick.account.isManual && (
          <div className="flex items-center gap-3 px-6 py-4">
            <span className="ds-disc">
              <ArrowRightLeft className="size-5" strokeWidth={1.5} />
            </span>
            <div className="ds-row__txt">
              <span className="ds-label-strong">
                {t('accounts.group.switchTitle', { name: group.pick.account.displayName })}
              </span>
              <span className="ds-t-sub">
                {t('accounts.group.switchSub', { left: formatPercent(group.pick.pace.left) })}
              </span>
            </div>
            <DsButton
              variant="primary"
              size="sm"
              onClick={() => group.pick && switcher.switchTo(group.pick.account)}
            >
              {t('accounts.group.apply')}
            </DsButton>
          </div>
        )}
        {group.overloaded && (
          <div className="flex items-center gap-3 px-6 py-4">
            <span className="ds-disc ds-disc--review">
              <TrendingUp className="size-5" strokeWidth={1.5} />
            </span>
            <div className="ds-row__txt">
              <span className="ds-label-strong">
                {t('accounts.group.hotTitle', {
                  name: group.overloaded.account.displayName,
                  used: formatPercent(group.overloaded.pace.weeklyUsed),
                })}
              </span>
              <span className="ds-t-sub">{t('accounts.group.hotSub')}</span>
            </div>
          </div>
        )}
        {(!group.pick || group.pick.account.isActive || group.pick.account.isManual) &&
          !group.overloaded && (
            <p className="px-6 py-4 text-sm text-ink-600">{t('accounts.group.noMoves')}</p>
          )}
      </div>

      {dialog?.kind === 'edit' && (
        <EditAccountDialog account={dialog.account} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'record' && (
        <RecordUsageDialog account={dialog.account} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'read' && isManualProvider(dialog.account.provider) && (
        <ReadUsageDialog
          account={dialog.account}
          provider={dialog.account.provider}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveAccountDialog account={dialog.account} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
