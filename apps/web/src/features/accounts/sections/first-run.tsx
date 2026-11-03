import { DsButton, DsStateCard } from '@flama/design-system-web';
import {
  Activity,
  CalendarDays,
  CreditCard,
  Flame,
  LayoutDashboard,
  Users,
} from '@flama/design-system-web/icons';
import { useAccounts } from '@flama/frontend-consumer/react';
import { PageHead } from '@flama/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AddAccountMenu } from './add-account-menu';

const ICONS = {
  overview: LayoutDashboard,
  subscriptions: CreditCard,
  people: Users,
  usage: Activity,
  tokenmaxx: Flame,
  renewals: CalendarDays,
} as const;

export type FirstRunPage = keyof typeof ICONS;

/**
 * The design's first run: until the person tracks an account, a page shows
 * its title, "Nothing tracked yet" and one card saying what will appear and
 * how to add the first account, instead of a layout full of zeros. Once the
 * accounts load and there is at least one, the page itself renders.
 */
export function FirstRun({
  page,
  title,
  children,
}: {
  page: FirstRunPage;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { data: accounts } = useAccounts();
  if (!accounts || accounts.length > 0) return children;
  const Icon = ICONS[page];
  const add = (variant: 'primary' | 'secondary', size: 'sm' | 'md') => (
    <AddAccountMenu trigger={(props) => <DsButton variant={variant} size={size} {...props} />} />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        className="mb-0"
        title={title}
        sub={t('accounts.firstRun.sub')}
        action={page === 'subscriptions' || page === 'people' ? add('primary', 'sm') : undefined}
      />
      <DsStateCard
        icon={<Icon strokeWidth={1.5} />}
        title={t(`accounts.firstRun.${page}.title`)}
        text={t(`accounts.firstRun.${page}.text`)}
        actions={add('secondary', 'md')}
      />
    </div>
  );
}
