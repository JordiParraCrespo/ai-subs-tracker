import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@flama/design-system-web';
import { ChevronUp, LogOut, Moon, Sun, User } from '@flama/design-system-web/icons';
import { useLogout, useProfile } from '@flama/frontend-core/react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { useShell } from '../hooks/use-shell';

const ROW = 'h-10 gap-2.5 rounded-[10px] px-2.5 text-sm font-medium [&_svg]:size-4';

/**
 * The account card at the foot of the sidebar (`.ds-account`): the brand tile,
 * the person's name and email, and a chevron. It opens the design's menu
 * above it: who is signed in, the account links, the theme switch, sign out.
 */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation();
  const { userMenuLinks = [] } = useShell();
  const { data: user } = useProfile();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const logout = useLogout({ onSuccess: () => navigate({ to: '/login' }) });
  const isDark = theme === 'dark';
  // From the stored fields, not the entity's getters: the users query is
  // persisted, and a profile restored from storage is a plain object.
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || '';
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('nav.profile')}
        className={cn(
          'flex h-13 w-full flex-none items-center gap-3 rounded-xl bg-sidebar-tile pr-3 pl-2.5 text-left text-sidebar-ink-active outline-1 -outline-offset-1 outline-sidebar-tile-outline transition-colors hover:bg-sidebar-fill',
          collapsed && 'justify-center px-0',
        )}
      >
        <span className="grid size-8 flex-none place-items-center rounded-lg bg-brand text-on-brand">
          <User className="size-4.5" strokeWidth={1.5} />
        </span>
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold">{name}</span>
              <span className="truncate text-xs text-sidebar-ink-muted">{user?.email}</span>
            </span>
            <ChevronUp className="size-4 flex-none text-sidebar-ink-muted" strokeWidth={1.5} />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={12}
        className="w-62 rounded-2xl p-0"
      >
        <div className="flex items-center gap-3 p-4">
          <span className="grid size-10 flex-none place-items-center rounded-xl bg-brand text-sm font-bold text-on-brand">
            {initials}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold text-ink-900">{name}</span>
            <span className="truncate text-xs text-ink-600">{user?.email}</span>
          </span>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuGroup className="p-1.5">
          {userMenuLinks.map((link) => {
            const Icon = link.icon;
            return (
              <DropdownMenuItem key={link.to} className={ROW} render={<Link to={link.to} />}>
                <Icon strokeWidth={1.5} />
                {t(`nav.${link.labelKey}`)}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuItem className={ROW} onClick={() => setTheme(isDark ? 'light' : 'dark')}>
            {isDark ? <Sun strokeWidth={1.5} /> : <Moon strokeWidth={1.5} />}
            {isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuItem className={cn(ROW, 'text-ink-600')} onClick={() => logout.mutate()}>
            <LogOut strokeWidth={1.5} />
            {t('nav.logOut')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
