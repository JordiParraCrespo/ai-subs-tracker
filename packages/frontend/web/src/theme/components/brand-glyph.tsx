import { cn } from '@flama/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The ResetOwl mark: the owl on its violet tile, the same drawing as
 * `apps/web/public/favicon.svg`, in the `brand` / `on-brand` tokens so the
 * two never drift apart. Every place the product shows its logo (the
 * sidebar, the mobile bar, the public header) renders this one component.
 */
export function BrandGlyph({
  className,
  size = 28,
  ...props
}: React.ComponentProps<'svg'> & { size?: number }) {
  const { t } = useTranslation();

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={t('common.appName')}
      className={cn('shrink-0', className)}
      {...props}
    >
      <rect width="32" height="32" rx="7" className="fill-brand" />
      <g className="fill-on-brand">
        <polygon points="7.76,5.65 13.89,10.19 7.55,12.83" />
        <polygon points="24.24,5.65 18.11,10.19 24.45,12.83" />
        <ellipse cx="16" cy="17.27" rx="8.45" ry="8.87" />
      </g>
      <g className="fill-brand">
        <circle cx="12.41" cy="15.16" r="3.17" />
        <circle cx="19.59" cy="15.16" r="3.17" />
        <polygon points="14.84,17.48 17.16,17.48 16,19.8" />
      </g>
      <g className="fill-on-brand">
        <circle cx="12.41" cy="15.16" r="1.27" />
        <circle cx="19.59" cy="15.16" r="1.27" />
      </g>
    </svg>
  );
}
