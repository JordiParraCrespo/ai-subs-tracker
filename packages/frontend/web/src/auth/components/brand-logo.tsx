import { cn } from '@flama/design-system-web';
import { useTranslation } from 'react-i18next';
import { BrandGlyph } from '../../theme';

/** Mark plus wordmark, as it sits in the public pages' header. */
export function BrandLogo({ className, label }: { className?: string; label?: string }) {
  const { t } = useTranslation();

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandGlyph />
      <span className="text-base font-medium text-ink-900">{label ?? t('common.appName')}</span>
    </div>
  );
}
