import { useUserSettings } from '@flama/frontend-core/react';
import { PageHead } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';

/** The Settings title, over the workspace's name once it has one. */
export function SettingsHead() {
  const { t } = useTranslation();
  const settings = useUserSettings();

  return (
    <PageHead
      title={t('settings.title')}
      sub={settings.data?.workspaceName ?? t('settings.subtitle')}
    />
  );
}
