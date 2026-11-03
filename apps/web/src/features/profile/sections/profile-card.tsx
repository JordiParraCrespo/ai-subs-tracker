import { Alert, AlertDescription, DsSettingsCard, Skeleton, toast } from '@flama/design-system-web';
import { User } from '@flama/design-system-web/icons';
import { useMyProfile, useUpdateMyProfile } from '@flama/frontend-consumer/react';
import { useErrorMessage } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { NameForm } from '@/features/profile/forms/name-form';

/** Settings' Profile card: the reader's name, saved as they leave a field, and their email. */
export function ProfileCard() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const profile = useMyProfile();
  const update = useUpdateMyProfile({
    onSuccess: () => toast.success(t('settings.profile.saved')),
  });

  return (
    <DsSettingsCard
      id="profile"
      icon={<User />}
      title={t('settings.profile.title')}
      description={t('settings.profile.description')}
    >
      {update.error && (
        <Alert variant="destructive">
          <AlertDescription>{resolveError(update.error).message}</AlertDescription>
        </Alert>
      )}
      {profile.data ? (
        <NameForm
          saved={{ firstName: profile.data.firstName, lastName: profile.data.lastName }}
          email={profile.data.email}
          onSave={(values) => update.mutate(values)}
        />
      ) : (
        <Skeleton className="h-15 w-full" />
      )}
    </DsSettingsCard>
  );
}
