import { toast } from '@flama/design-system-web';
import { useUpdateUserSettings, useUserSettings } from '@flama/frontend-core/react';
import { useErrorMessage } from '@flama/frontend-web';
import { DEFAULT_USER_SETTINGS, type UpdateUserSettingsDto } from '@flama/shared/schemas/profile';

/**
 * Changes sent but not yet confirmed, across every card. Each save carries
 * them, so a second card saving before the first answers does not send the
 * old value back.
 */
const unconfirmed: Partial<UpdateUserSettingsDto> = {};

/**
 * Settings are saved whole (`PUT`), but each card changes one of them: this
 * fills the rest in from the saved record and from changes still in flight,
 * and runs every save in one serial scope, so a card never sends a value it
 * does not show and so never reverts one another card just saved.
 */
export function useSaveSettings(saved?: string) {
  const resolveError = useErrorMessage();
  const settings = useUserSettings();
  const update = useUpdateUserSettings({
    scope: { id: 'user-settings' },
    onSuccess: (stored) => {
      for (const key of Object.keys(unconfirmed) as (keyof UpdateUserSettingsDto)[]) {
        if (stored[key] === unconfirmed[key]) delete unconfirmed[key];
      }
      if (saved) toast.success(saved);
    },
    // A refused change is not carried into the next save.
    onError: (_error, sent) => {
      for (const key of Object.keys(sent) as (keyof UpdateUserSettingsDto)[]) {
        if (sent[key] === unconfirmed[key]) delete unconfirmed[key];
      }
    },
  });

  const save = (change: Partial<UpdateUserSettingsDto>) => {
    const base = settings.data ?? DEFAULT_USER_SETTINGS;
    update.mutate({
      theme: base.theme,
      locale: base.locale,
      density: base.density,
      weeklyDigest: base.weeklyDigest,
      productUpdates: base.productUpdates,
      ...unconfirmed,
      ...change,
    });
    Object.assign(unconfirmed, change);
  };

  const failure = update.error ? resolveError(update.error).message : null;
  return { settings, save, failure, isPending: update.isPending };
}
