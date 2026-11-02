import { useMyProfile } from '@flama/frontend-consumer/react';
import { PageHead } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { DesktopStatus } from '../sections/desktop-status';
import { NeedsAttention } from '../sections/needs-attention';
import { OverviewHeadline } from '../sections/overview-headline';
import { UpcomingResets } from '../sections/upcoming-resets';

/** The landing page: what the plans cost, what they returned, and what needs a look. */
export function OverviewScreen() {
  const { t } = useTranslation();
  const { data: profile } = useMyProfile();

  return (
    <>
      <PageHead
        title={t('accounts.overview.greeting', { name: profile?.firstName ?? '' })}
        sub={t('accounts.overview.sub')}
      />
      <DesktopStatus />
      <OverviewHeadline />
      <div className="grid gap-6 lg:grid-cols-2">
        <NeedsAttention />
        <UpcomingResets />
      </div>
    </>
  );
}
