import {
  Activity,
  CalendarDays,
  CreditCard,
  Flame,
  LayoutDashboard,
  Settings,
  Users,
} from '@flama/design-system-web/icons';
import type { NavItem, NavLink } from '@flama/frontend-web';

/**
 * The workspace's destinations, in the order the sidebar lists them: Dashboard
 * first, then the working surfaces, with Settings held back at the bottom. One
 * model, read by both the sidebar and the command palette, so a page can never
 * appear in one and not the other.
 *
 * Every row is ungated: each screen reads only the caller's own profile and
 * accounts, and every user's Settings are their own. A row that does
 * need a permission takes its `policies` from `ENDPOINT_POLICIES` in
 * `@flama/shared/permissions`, keyed by the endpoint its screen reads
 * (`ENDPOINT_POLICIES['/roles']`), never a rule list written out here — the
 * API's `endpoint-policies.spec.ts` holds the controller to that same entry.
 */
export const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard', policies: [] },
  { to: '/accounts', icon: CreditCard, labelKey: 'accounts', policies: [] },
  { to: '/people', icon: Users, labelKey: 'people', policies: [] },
  { to: '/usage', icon: Activity, labelKey: 'usage', policies: [] },
  { to: '/tokenmaxx', icon: Flame, labelKey: 'tokenmaxx', policies: [] },
  { to: '/renewals', icon: CalendarDays, labelKey: 'renewals', policies: [] },
] as const satisfies readonly NavItem[];

/** The account menu's own destinations, above the language list. */
export const USER_MENU_LINKS = [
  { to: '/settings', icon: Settings, labelKey: 'settings' },
] as const satisfies readonly NavLink[];
