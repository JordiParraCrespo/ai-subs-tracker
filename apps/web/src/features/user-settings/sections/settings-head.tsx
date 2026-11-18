import { useUserSettings } from '@flama/frontend-core/react';
import { desktopBridge as desktop, PageHead } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The Settings title, over the workspace's name once it has one, and in the
 * desktop app the version of ResetOwl it is (a product name and a number,
 * so not translated).
 */
export function SettingsHead() {
  const { t } = useTranslation();
  const settings = useUserSettings();

  return (
    <PageHead
      title={t('settings.title')}
      sub={
        <>
          {settings.data?.workspaceName ?? t('settings.subtitle')}
          {desktop && (
            <span data-testid="app-version" className="mt-1 block font-mono text-xs text-ink-400">
              ResetOwl {desktop.version}
            </span>
          )}
        </>
      }
    />
  );
}
