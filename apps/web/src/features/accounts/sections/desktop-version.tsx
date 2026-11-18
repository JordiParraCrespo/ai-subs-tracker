import {
  desktopBridge as desktop,
  GroupHeading,
  RowControl,
  RowMeta,
  SectionCard,
  SectionRow,
} from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';

/** The version of this copy of the ResetOwl desktop app. Renders nothing in a browser. */
export function DesktopVersion() {
  const { t } = useTranslation();
  if (!desktop) return null;

  return (
    <>
      <GroupHeading className="mt-8">{t('accounts.settings.versionTitle')}</GroupHeading>
      <SectionCard>
        <SectionRow>
          <RowMeta name="ResetOwl" />
          <RowControl>
            <span className="font-mono text-sm text-ink-600 select-text">{desktop.version}</span>
          </RowControl>
        </SectionRow>
      </SectionCard>
    </>
  );
}
