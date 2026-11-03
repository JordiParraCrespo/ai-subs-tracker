import { DsButton, DsStateCard } from '@flama/design-system-web';
import { RotateCw, TriangleAlert } from '@flama/design-system-web/icons';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { NavTo } from '../lib/nav';

const ICON = { className: 'size-4', strokeWidth: 1.5 } as const;

/**
 * The design's "This page hit an error", for a route's `errorComponent`. The
 * reload is the honest fix: the state that broke the page goes with it, and
 * nothing the person saved lives in the page.
 */
export function ErrorScreen({ home }: { home: NavTo }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <DsStateCard
      variant="status"
      icon={<TriangleAlert strokeWidth={1.5} />}
      eyebrow={t('pages.status.error.eyebrow')}
      title={t('pages.status.error.title')}
      text={t('pages.status.error.text')}
      actions={
        <>
          <DsButton
            variant="primary"
            size="sm"
            icon={<RotateCw {...ICON} />}
            onClick={() => window.location.reload()}
          >
            {t('pages.status.error.reload')}
          </DsButton>
          <DsButton variant="ghost" size="sm" onClick={() => navigate({ to: home })}>
            {t('pages.status.goHome')}
          </DsButton>
        </>
      }
    />
  );
}
