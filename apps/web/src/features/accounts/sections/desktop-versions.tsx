import { Skeleton } from '@flama/design-system-web';
import { GroupHeading, RowControl, RowMeta, SectionCard, SectionRow } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { useDesktopVersions } from '../hooks/use-desktop-versions';
import { PROVIDER_NAMES } from '../lib/providers';

/**
 * What this copy of ResetOwl is built on and the coding tools it found:
 * the app, the screens, the runtime, the OS and each vendor CLI. Product and
 * runtime names are proper nouns, so they are not translated.
 */
export function DesktopVersions() {
  const { t } = useTranslation();
  const versions = useDesktopVersions();

  const rows: { name: string; description?: string; version: string | null }[] = versions
    ? [
        { name: 'ResetOwl', version: versions.app },
        { name: t('accounts.settings.versionsScreens'), version: __APP_VERSION__ },
        { name: 'Electron', version: versions.electron },
        { name: 'Chromium', version: versions.chrome },
        { name: 'Node.js', version: versions.node },
        { name: 'V8', version: versions.v8 },
        { name: t('accounts.settings.versionsOs'), version: versions.os },
        ...versions.clis.map((cli) => ({
          name: PROVIDER_NAMES[cli.provider],
          description: cli.command,
          version: cli.version,
        })),
      ]
    : [];

  return (
    <>
      <GroupHeading className="mt-8" description={t('accounts.settings.versionsDescription')}>
        {t('accounts.settings.versionsTitle')}
      </GroupHeading>
      <SectionCard>
        {!versions && (
          <SectionRow>
            <Skeleton className="h-5 w-full" />
          </SectionRow>
        )}
        {rows.map((row) => (
          <SectionRow key={row.name}>
            <RowMeta
              name={row.name}
              description={
                row.description ? (
                  <code className="font-mono text-xs">{row.description}</code>
                ) : null
              }
            />
            <RowControl>
              <span className="font-mono text-sm text-ink-600 select-text">
                {row.version || t('accounts.settings.versionsMissing')}
              </span>
            </RowControl>
          </SectionRow>
        ))}
      </SectionCard>
    </>
  );
}
