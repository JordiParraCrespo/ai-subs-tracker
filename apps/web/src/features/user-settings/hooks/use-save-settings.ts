import { toast } from '@flama/design-system-web';
import { useUpdateUserSettings, useUserSettings } from '@flama/frontend-core/react';
import { useErrorMessage } from '@flama/frontend-web';
import { DEFAULT_USER_SETTINGS, type UpdateUserSettingsDto } from '@flama/shared/schemas/profile';

/**
 * Settings are saved whole (`PUT`), but each card changes one of them: this
 * fills the rest in from the saved record, so a card never sends a value it
 * does not show and so never reverts one another card just saved.
 */
export function useSaveSettings(saved?: string) {
  const resolveError = useErrorMessage();
  const settings = useUserSettings();
  const update = useUpdateUserSettings({
    onSuccess: () => saved && toast.success(saved),
    onError: (error) => toast.error(resolveError(error).message),
  });

  const save = (change: Partial<UpdateUserSettingsDto>) => {
    const base = settings.data ?? DEFAULT_USER_SETTINGS;
    update.mutate({
      theme: base.theme,
      locale: base.locale,
      density: base.density,
      weeklyDigest: base.weeklyDigest,
      productUpdates: base.productUpdates,
      ...change,
    });
  };

  return { settings, save, isPending: update.isPending };
}
