import { DsOptionTile, DsSettingsCard } from '@flama/design-system-web';
import { Contrast, Monitor, Moon, Sun } from '@flama/design-system-web/icons';
import { useTheme } from '@flama/frontend-web';
import { THEMES, type Theme } from '@flama/shared/schemas/profile';
import { useTranslation } from 'react-i18next';
import { useSaveSettings } from '../hooks/use-save-settings';

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const satisfies Record<Theme, unknown>;

/**
 * Settings' Appearance card: light, dark or the system's. The theme applies
 * at once on this device; the saved one is the default on the others.
 */
export function AppearanceCard() {
  const { t } = useTranslation();
  const { settings, save } = useSaveSettings();
  const { theme, setTheme } = useTheme();
  const chosen: Theme = settings.data?.theme ?? theme;

  return (
    <DsSettingsCard
      id="appearance"
      icon={<Contrast />}
      title={t('settings.appearance.title')}
      description={t('settings.appearance.description')}
    >
      <div role="radiogroup" aria-label={t('settings.appearance.title')} className="ds-option-grid">
        {THEMES.map((value) => {
          const Icon = ICONS[value];
          return (
            <DsOptionTile
              key={value}
              icon={<Icon />}
              label={t(`settings.appearance.${value}`)}
              checked={chosen === value}
              onClick={() => {
                // This device paints light or dark; "system" picks whichever
                // the OS prefers now, and is what the saved setting remembers.
                const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                setTheme(value === 'system' ? (dark ? 'dark' : 'light') : value);
                save({ theme: value });
              }}
            />
          );
        })}
      </div>
    </DsSettingsCard>
  );
}
