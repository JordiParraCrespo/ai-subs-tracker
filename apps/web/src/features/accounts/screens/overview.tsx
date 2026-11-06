import { useMyProfile } from '@flama/frontend-consumer/react';
import { PageHead } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { FirstRun } from '../sections/first-run';
import { NeedsAttention } from '../sections/needs-attention';
import { OverviewHeadline } from '../sections/overview-headline';
import { UpcomingResets } from '../sections/upcoming-resets';

/** Part of the day for the greeting: morning until noon, afternoon until six. */
function partOfDay(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  return hour < 18 ? 'afternoon' : 'evening';
}

/** The landing page, laid out as the design's overview. */
export function OverviewScreen() {
  const { t } = useTranslation();
  const { data: profile } = useMyProfile();
  const greeting = t(`accounts.overview.greeting.${partOfDay(new Date().getHours())}`, {
    name: profile?.firstName ?? '',
  });

  return (
    <FirstRun page="overview" title={greeting}>
      {/* Fills the window, so the chart can give up height to the cards;
          a short window (a 768px laptop) tightens the gaps too. */}
      <div className="flex flex-1 flex-col gap-6 [@media(max-height:800px)]:gap-4">
        <PageHead className="mb-0" title={greeting} sub={t('accounts.overview.sub')} />
        <OverviewHeadline />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-stretch gap-4">
          <NeedsAttention />
          <UpcomingResets />
        </div>
      </div>
    </FirstRun>
  );
}
