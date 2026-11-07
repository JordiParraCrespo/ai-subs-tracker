import { cn, Kbd } from '@flama/design-system-web';
import { PanelLeft, Search } from '@flama/design-system-web/icons';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { BrandGlyph } from '../../theme';
import { useAuthorizedNav } from '../hooks/use-authorized-nav';
import { UserMenu } from './user-menu';

/**
 * The design's sidebar (`designs/_ds`, `.ds-sidebar`): 272px on the frame,
 * dark in both themes. Brand and collapse button, the ⌘K search field, the
 * 44px nav rows, and the account card pinned to the foot. Collapsed, it is a
 * rail of icons.
 */
export function AppSidebar({
  collapsed,
  onCollapse,
  onSearch,
  onNavigate,
  className,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  onSearch: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const entries = useAuthorizedNav();

  return (
    <aside
      className={cn(
        'flex-none flex-col gap-3 bg-frame p-3 text-sidebar-ink-active',
        collapsed ? 'w-17' : 'w-68',
        className,
      )}
    >
      <div className={cn('flex items-center justify-between', !collapsed && 'pl-3')}>
        {!collapsed && (
          <span className="flex items-center gap-2.5 text-base leading-none font-bold tracking-tighter">
            <BrandGlyph aria-hidden />
            {t('common.appName')}
          </span>
        )}
        <button
          type="button"
          aria-label={t('nav.toggleSidebar')}
          onClick={onCollapse}
          className="grid size-11 place-items-center rounded-xl text-sidebar-ink-active transition-colors hover:bg-sidebar-fill"
        >
          <PanelLeft className="size-5" strokeWidth={1.5} />
        </button>
      </div>

      <button
        type="button"
        onClick={onSearch}
        aria-label={t('nav.search')}
        className="flex h-10 w-full flex-none items-center gap-3 rounded-xl bg-sidebar-field px-3 text-sm font-medium text-sidebar-ink-muted outline-1 -outline-offset-1 outline-sidebar-outline transition-colors hover:bg-sidebar-fill"
      >
        <Search className="size-5 flex-none" strokeWidth={1.5} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{t('nav.search')}</span>
            <Kbd className="h-5 rounded-sm bg-transparent px-1.5 text-xs text-ink-400 outline-1 -outline-offset-1 outline-sidebar-tile-outline">
              ⌘K
            </Kbd>
          </>
        )}
      </button>

      <nav
        aria-label={t('nav.primaryNavigation')}
        className="flex flex-1 flex-col gap-0.5 overflow-auto"
      >
        {entries.map((entry) => {
          const Icon = entry.icon;
          const active = pathname === entry.to || pathname.startsWith(`${entry.to}/`);
          const label = t(`nav.${entry.labelKey}`);
          return (
            <Link
              key={entry.to}
              to={entry.to}
              onClick={onNavigate}
              aria-label={collapsed ? label : undefined}
              data-active={active || undefined}
              className="flex h-11 w-full flex-none items-center gap-3 rounded-xl px-3 text-sm font-semibold text-sidebar-ink transition-colors hover:bg-sidebar-fill hover:text-sidebar-ink-active data-active:bg-sidebar-fill data-active:text-sidebar-ink-active"
            >
              <Icon className="size-5 flex-none" strokeWidth={1.5} />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <UserMenu collapsed={collapsed} />
    </aside>
  );
}
