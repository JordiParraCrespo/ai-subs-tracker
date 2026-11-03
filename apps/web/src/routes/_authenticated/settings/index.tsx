import { createFileRoute } from '@tanstack/react-router';
// flama:begin organizations
// flama:end organizations
import { DesktopSettings } from '@/features/accounts/sections/desktop-settings';
import { ProfileCard } from '@/features/profile/sections/profile-card';
import { SecurityCard } from '@/features/profile/sections/security-card';
import { AppearanceCard } from '@/features/user-settings/sections/appearance-card';
import { LanguageCard } from '@/features/user-settings/sections/language-card';
import { SettingsHead } from '@/features/user-settings/sections/settings-head';
import { WorkspaceCard } from '@/features/user-settings/sections/workspace-card';

/**
 * The cards, in the order the design stacks them in its single 720px column:
 * a module that adds a card adds its row here and nothing else.
 */
const SECTIONS = [
  { key: 'profile', Card: ProfileCard },
  { key: 'security', Card: SecurityCard },
  { key: 'workspace', Card: WorkspaceCard },
  // flama:begin organizations
  // flama:end organizations
  { key: 'language', Card: LanguageCard },
  { key: 'appearance', Card: AppearanceCard },
  { key: 'desktop', Card: DesktopSettings },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

const PANES: readonly SectionKey[] = SECTIONS.map((section) => section.key);

/**
 * `?section=` is still accepted, so links into settings keep working: the
 * page carries every card, each with its key as its id, so a link that names
 * one lands on it.
 *
 * Everything else in the search string is carried through untouched: what
 * `validateSearch` returns *becomes* the search, so narrowing it to `section`
 * would delete what another reader of the URL wrote there.
 */
export const Route = createFileRoute('/_authenticated/settings/')({
  validateSearch: (
    search: Record<string, unknown>,
  ): Record<string, unknown> & { section?: SectionKey } => {
    const { section: requested, ...rest } = search;
    return PANES.includes(requested as SectionKey)
      ? { ...rest, section: requested as SectionKey }
      : rest;
  },
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <SettingsHead />
      <div className="mx-auto flex w-full max-w-180 flex-col gap-6">
        {SECTIONS.map(({ key, Card }) => (
          <Card key={key} />
        ))}
      </div>
    </>
  );
}
