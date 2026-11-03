import { Alert, AlertDescription, DsSettingsCard, Skeleton } from '@flama/design-system-web';
import { Building2 } from '@flama/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { WorkspaceNameForm } from '../forms/workspace-name-form';
import { useSaveSettings } from '../hooks/use-save-settings';

/** Settings' Workspace card: what the person calls their set of subscriptions. */
export function WorkspaceCard() {
  const { t } = useTranslation();
  const { settings, save, failure } = useSaveSettings(t('settings.workspace.saved'));

  return (
    <DsSettingsCard
      id="workspace"
      icon={<Building2 />}
      title={t('settings.workspace.title')}
      description={t('settings.workspace.description')}
    >
      {failure && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      {settings.data ? (
        <WorkspaceNameForm
          saved={settings.data.workspaceName}
          onSave={(workspaceName) => save({ workspaceName })}
        />
      ) : (
        <Skeleton className="h-15 w-full" />
      )}
    </DsSettingsCard>
  );
}
