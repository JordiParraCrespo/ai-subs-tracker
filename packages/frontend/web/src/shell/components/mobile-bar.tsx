import { Menu } from '@flama/design-system-web/icons';
import { useTranslation } from 'react-i18next';
import { BrandGlyph } from '../../theme';

/** Below `lg`, where the sidebar is a sheet: the brand and the button that opens it. */
export function MobileBar({ onMenu }: { onMenu: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex h-14 flex-none items-center justify-between px-5 text-sidebar-ink-active lg:hidden">
      <span className="flex items-center gap-2.5 text-base leading-none font-bold tracking-tighter">
        <BrandGlyph aria-hidden />
        {t('common.appName')}
      </span>
      <button
        type="button"
        aria-label={t('nav.toggleSidebar')}
        onClick={onMenu}
        className="grid size-11 place-items-center rounded-xl hover:bg-sidebar-fill"
      >
        <Menu className="size-5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
