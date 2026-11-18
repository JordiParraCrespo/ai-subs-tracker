import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DsSettingsCard,
  Switch,
} from '@flama/design-system-web';
import { ChevronDown, Laptop } from '@flama/design-system-web/icons';
import {
  desktopBridge as desktop,
  GroupHeading,
  RowControl,
  RowMeta,
  SectionCard,
  SectionRow,
} from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { useDesktopSetup } from '../hooks/use-desktop-setup';
import { DesktopStatus } from './desktop-status';

/**
 * Settings that act on this computer. In a browser it says where they live
 * instead, since only the desktop app can touch the machine.
 */
export function DesktopSettings() {
  const { t } = useTranslation();
  const setup = useDesktopSetup();

  if (!desktop) {
    return (
      <DsSettingsCard
        id="desktop"
        icon={<Laptop />}
        title={t('accounts.settings.title')}
        description={t('accounts.settings.description')}
      >
        <SectionCard>
          <SectionRow>
            <RowMeta
              name={t('accounts.settings.browserTitle')}
              description={t('accounts.settings.browserDescription')}
            />
          </SectionRow>
        </SectionCard>
      </DsSettingsCard>
    );
  }

  return (
    <DsSettingsCard
      id="desktop"
      icon={<Laptop />}
      title={t('accounts.settings.title')}
      description={t('accounts.settings.description')}
    >
      <DesktopStatus />
      <GroupHeading description={t('accounts.settings.shellDescription')}>
        {t('accounts.settings.shellTitle')}
      </GroupHeading>
      <SectionCard className="mb-8">
        <Collapsible>
          <SectionRow>
            <RowMeta
              name={
                setup.shell?.installed
                  ? t('accounts.settings.shellInstalled', { file: setup.shell.rcFile ?? '' })
                  : t('accounts.settings.shellNotInstalled')
              }
              description={
                setup.shell?.snippet ? (
                  <CollapsibleTrigger className="group mt-1 inline-flex items-center gap-1 text-xs text-ink-600 hover:text-ink-900">
                    <span className="group-data-[panel-open]:hidden">
                      {t('accounts.settings.shellShowCode')}
                    </span>
                    <span className="hidden group-data-[panel-open]:inline">
                      {t('accounts.settings.shellHideCode')}
                    </span>
                    <ChevronDown className="size-3.5 transition-transform group-data-[panel-open]:rotate-180" />
                  </CollapsibleTrigger>
                ) : undefined
              }
            />
            <RowControl>
              <Button
                variant="outline"
                size="sm"
                disabled={!setup.shell?.rcFile || setup.shell.installed}
                onClick={() => void setup.installShell()}
              >
                {t('accounts.settings.shellInstall')}
              </Button>
            </RowControl>
          </SectionRow>
          <CollapsibleContent className="px-[18px] pb-4">
            <pre className="max-h-80 overflow-auto rounded-lg border border-border-subtle bg-surface-sunken p-3 font-mono text-xs leading-relaxed text-ink-600">
              {setup.shell?.snippet}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      </SectionCard>

      <GroupHeading description={t('accounts.settings.liveDescription')}>
        {t('accounts.settings.liveTitle')}
      </GroupHeading>
      <SectionCard>
        {setup.targets.length === 0 && (
          <SectionRow>
            <RowMeta name={t('accounts.settings.liveNone')} />
          </SectionRow>
        )}
        {setup.targets.map((target) => (
          <SectionRow key={target.home}>
            <RowMeta
              name={target.home}
              description={target.available ? undefined : t('accounts.settings.liveTaken')}
            />
            <RowControl>
              <Switch
                checked={target.installed}
                disabled={!target.available && !target.installed}
                onCheckedChange={(on) => void setup.toggleLiveFeed(target.home, on)}
                aria-label={t('accounts.settings.liveToggle', { home: target.home })}
              />
            </RowControl>
          </SectionRow>
        ))}
      </SectionCard>
    </DsSettingsCard>
  );
}
