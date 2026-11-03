import { Alert, AlertDescription, DsFilterSelect, DsSettingsCard } from '@flama/design-system-web';
import { Languages } from '@flama/design-system-web/icons';
import { chooseLocale, useLocale } from '@flama/frontend-web';
import { DEFAULT_USER_SETTINGS, LOCALES, type Locale } from '@flama/shared/schemas/profile';
import { useTranslation } from 'react-i18next';
import { useSaveSettings } from '../hooks/use-save-settings';

/**
 * Settings' Language card. The language switches the moment it is picked
 * (it is also chosen per device); the saved one is what another device and
 * a queued email start from.
 */
export function LanguageCard() {
  const { t } = useTranslation();
  const { save, failure } = useSaveSettings();
  const shown = useLocale();
  const locale = (LOCALES as readonly string[]).includes(shown)
    ? (shown as Locale)
    : DEFAULT_USER_SETTINGS.locale;

  return (
    <DsSettingsCard
      id="language"
      icon={<Languages />}
      title={t('settings.language.title')}
      description={t('settings.language.description')}
    >
      {failure && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <div className="flex">
        <DsFilterSelect
          neutral
          icon={<Languages className="size-4" />}
          options={LOCALES.map((value) => ({ value, label: t(`language.${value}`) }))}
          value={locale}
          onChange={(next) => {
            void chooseLocale(next);
            save({ locale: next });
          }}
        />
      </div>
    </DsSettingsCard>
  );
}
