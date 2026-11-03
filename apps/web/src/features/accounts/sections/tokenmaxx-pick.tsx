import { DsAvatar, DsButton, DsCard, DsFilterSelect } from '@flama/design-system-web';
import {
  Check,
  Flame,
  Gauge,
  Layers,
  SkipForward,
  Target,
  X,
} from '@flama/design-system-web/icons';
import { useAccounts } from '@flama/frontend-consumer/react';
import { useLocale } from '@flama/frontend-web';
import { useNow } from '@flama/react-hooks';
import { PROVIDER_IDS, type ProviderId } from '@flama/shared/subscriptions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResetIn } from '../hooks/use-reset-in';
import { useSwitchAccount } from '../hooks/use-switch-account';
import { formatMoney } from '../lib/format';
import { PROVIDER_NAMES } from '../lib/providers';
import { pickCandidates, type TokenmaxxGoal, tokenmaxxRows } from '../lib/tokenmaxx-model';

const ICON = { className: 'size-4', strokeWidth: 1.5 } as const;
const GOALS: TokenmaxxGoal[] = ['expiring', 'headroom', 'value', 'pace'];
const MINS = ['0', '20', '40', '60'] as const;

/**
 * The design's "Pick next for" row and the two cards under it: the account to
 * use next (with Switch to it and Skip) and the four figures beside it.
 */
export function TokenmaxxPick() {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(60_000);
  const { data: accounts = [] } = useAccounts();
  const switcher = useSwitchAccount();
  const resetIn = useResetIn();
  const [provider, setProvider] = useState<ProviderId | 'all'>('all');
  const [goal, setGoal] = useState<TokenmaxxGoal>('expiring');
  const [min, setMin] = useState<(typeof MINS)[number]>('0');
  const [skip, setSkip] = useState(0);

  const rows = tokenmaxxRows(accounts, new Date(now));
  const candidates = pickCandidates(rows, {
    provider: provider === 'all' ? undefined : provider,
    goal,
    minLeft: Number(min),
  });
  const pick = candidates.length ? candidates[skip % candidates.length] : undefined;
  const filtered = provider !== 'all' || min !== '0';
  const util = rows.length ? rows.reduce((sum, row) => sum + row.used, 0) / rows.length : 0;
  const atRisk = rows.reduce((sum, row) => sum + row.wasteCents, 0);

  const reason = (() => {
    if (!pick) return t('accounts.tm.loosen');
    if (goal === 'headroom') return t('accounts.tm.why.headroom', { left: Math.round(pick.left) });
    if (goal === 'value')
      return t('accounts.tm.why.value', {
        value: formatMoney(
          (pick.account.monthlyPriceCents * (pick.windowHours / 720) * pick.left) / 100,
          locale,
        ),
      });
    if (goal === 'pace') return t('accounts.tm.why.pace', { need: pick.need.toFixed(1) });
    if (pick.status === 'expiring')
      return t('accounts.tm.why.expiring', {
        left: Math.round(pick.left),
        when: resetIn(pick.hours),
      });
    return t('accounts.tm.why.need', { need: pick.need.toFixed(1), waste: Math.round(pick.waste) });
  })();

  return (
    <>
      <div className="ds-toolbar">
        <span className="ds-text-label ds-muted mr-1">{t('accounts.tm.pickFor')}</span>
        <DsFilterSelect<ProviderId | 'all'>
          icon={<Layers {...ICON} />}
          options={[
            { value: 'all', label: t('accounts.tm.anyTool') },
            ...PROVIDER_IDS.map((value) => ({ value, label: PROVIDER_NAMES[value] })),
          ]}
          value={provider}
          onChange={(next) => {
            setProvider(next);
            setSkip(0);
          }}
        />
        <DsFilterSelect<TokenmaxxGoal>
          icon={<Target {...ICON} />}
          neutral
          options={GOALS.map((value) => ({ value, label: t(`accounts.tm.goal.${value}`) }))}
          value={goal}
          onChange={(next) => {
            setGoal(next);
            setSkip(0);
          }}
        />
        <DsFilterSelect<(typeof MINS)[number]>
          icon={<Gauge {...ICON} />}
          options={MINS.map((value) => ({ value, label: t(`accounts.tm.min.${value}`) }))}
          value={min}
          onChange={(next) => {
            setMin(next);
            setSkip(0);
          }}
        />
        {filtered && (
          <DsButton
            size="text"
            icon={<X {...ICON} />}
            onClick={() => {
              setProvider('all');
              setMin('0');
              setSkip(0);
            }}
          >
            {t('accounts.tm.reset')}
          </DsButton>
        )}
        <div className="flex-1" />
        <span className="ds-text-label ds-muted">
          {pick
            ? t('accounts.tm.matching', {
                index: (skip % candidates.length) + 1,
                count: candidates.length,
              })
            : t('accounts.tm.noneMatching')}
        </span>
      </div>

      <div className="flex flex-wrap items-stretch gap-4">
        <div className="ds-card ds-card--promo flex min-w-0 flex-[3_1_460px] flex-col gap-5 p-6">
          <div className="ds-eyebrow flex items-center gap-2 opacity-85">
            <Flame {...ICON} />
            {t('accounts.tm.useNext')}
          </div>
          <div className="flex items-center gap-4">
            <DsAvatar initials={pick?.initials ?? '—'} color={pick?.color ?? '#404040'} size={52} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="ds-title-lg">{pick?.name ?? t('accounts.tm.noneName')}</span>
              {pick && (
                <span className="ds-text-label">
                  {t('accounts.tm.pickLine', {
                    left: `${Math.round(pick.left)}%`,
                    when: resetIn(pick.hours),
                  })}
                </span>
              )}
            </div>
          </div>
          <span className="ds-text-label text-pretty">{reason}</span>
          {pick && (
            <div className="mt-auto flex flex-wrap gap-2">
              <DsButton
                variant="primary"
                size="sm"
                icon={pick.account.isActive ? <Check {...ICON} /> : <Flame {...ICON} />}
                disabled={pick.account.isActive || switcher.isPending}
                onClick={() => switcher.switchTo(pick.account)}
              >
                {pick.account.isActive ? t('accounts.tm.inUse') : t('accounts.tm.switch')}
              </DsButton>
              <DsButton
                size="sm"
                icon={<SkipForward {...ICON} />}
                onClick={() => setSkip((n) => n + 1)}
              >
                {t('accounts.tm.skip')}
              </DsButton>
            </div>
          )}
        </div>
        <DsCard className="grid min-w-0 flex-[2_1_320px] grid-cols-2 content-center gap-6 p-6">
          {[
            {
              label: t('accounts.tm.stats.risk'),
              value: formatMoney(atRisk, locale),
              sub: t('accounts.tm.stats.riskSub'),
              tone: 'review',
            },
            {
              label: t('accounts.tm.stats.util'),
              value: `${Math.round(util)}%`,
              sub: t('accounts.tm.stats.utilSub', { count: rows.length }),
            },
            {
              label: t('accounts.tm.stats.limit'),
              value: String(rows.filter((row) => row.status === 'limit').length),
              sub: t('accounts.tm.stats.limitSub'),
            },
            {
              label: t('accounts.tm.stats.soon'),
              value: String(rows.filter((row) => row.hours <= 24).length),
              sub: t('accounts.tm.stats.soonSub'),
            },
          ].map((stat) => (
            <div key={stat.label} className="flex min-w-0 flex-col gap-1">
              <span className="ds-text-label ds-muted">{stat.label}</span>
              <span className={stat.tone === 'review' ? 'ds-title-lg ds-review' : 'ds-title-lg'}>
                {stat.value}
              </span>
              <span className="ds-t-sub">{stat.sub}</span>
            </div>
          ))}
        </DsCard>
      </div>
    </>
  );
}
