import { DsButton } from '@flama/design-system-web';
import { ArrowLeft } from '@flama/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/** The text "Back" a modal step puts at the left of its footer. */
export function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <DsButton size="text" icon={<ArrowLeft className="size-4" />} onClick={onClick}>
      {t('settings.security.back')}
    </DsButton>
  );
}
