import { DsButton, DsStateCard } from '@flama/design-system-web';
import { FileQuestion, LayoutDashboard } from '@flama/design-system-web/icons';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { NavTo } from '../lib/nav';

const ICON = { className: 'size-4', strokeWidth: 1.5 } as const;

/** The design's 404, inside the shell: nothing at this address, and a way home. */
export function NotFoundScreen({ home }: { home: NavTo }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <DsStateCard
      variant="status"
      icon={<FileQuestion strokeWidth={1.5} />}
      eyebrow={t('pages.status.notFound.eyebrow')}
      title={t('pages.status.notFound.title')}
      text={t('pages.status.notFound.text')}
      actions={
        <DsButton
          variant="primary"
          size="sm"
          icon={<LayoutDashboard {...ICON} />}
          onClick={() => navigate({ to: home })}
        >
          {t('pages.status.goHome')}
        </DsButton>
      }
    />
  );
}
