import { DsButton, DsSettingsCard } from '@flama/design-system-web';
import { ShieldCheck } from '@flama/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SecurityDialog } from '@/features/profile/dialogs/security';

/** Settings' Security card: one Manage button that opens the security dialog. */
export function SecurityCard() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <DsSettingsCard
      id="security"
      icon={<ShieldCheck />}
      title={t('settings.security.title')}
      description={t('settings.security.description')}
    >
      <div className="flex">
        <DsButton variant="primary" onClick={() => setOpen(true)}>
          {t('settings.security.manage')}
        </DsButton>
      </div>
      {open && <SecurityDialog onClose={() => setOpen(false)} />}
    </DsSettingsCard>
  );
}
