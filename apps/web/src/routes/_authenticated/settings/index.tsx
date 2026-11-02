import { PageHead } from '@flama/frontend-web';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
// flama:begin organizations
// flama:end organizations
import { DesktopSettings } from '@/features/accounts/sections/desktop-settings';
import { SecuritySection } from '@/features/profile/sections/security';

/**
 * The sections, in the order the page stacks them, each a card in the
 * design's single 720px column: a module that adds a pane adds its row here
 * and nothing else.
 */
const SECTIONS = [
  // flama:begin organizations
  // flama:end organizations
  { key: 'desktop', Pane: DesktopSettings },
  { key: 'security', Pane: SecuritySection },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

const PANES: readonly SectionKey[] = SECTIONS.map((section) => section.key);

/**
 * `?section=` is still accepted, so links into settings keep working: the
 * page carries every section, so a link that names one lands on it.
 *
 * Everything else in the search string is carried through untouched. What
 * `validateSearch` returns *becomes* the search, so narrowing it to `section`
 * would delete a table's page (`<prefix>_page`) on the next navigation — the table
 * would write it and the router would take it away. `section` is still the
 * only key this route reads or trusts.
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
  const { t } = useTranslation();

  return (
    <div className="flex max-w-180 flex-col gap-6">
      <PageHead className="mb-0" title={t('settings.title')} sub={t('settings.subtitle')} />
      {SECTIONS.map(({ key, Pane }) => (
        <section key={key} id={key} className="ds-card flex scroll-mt-6 flex-col p-6">
          <Pane />
        </section>
      ))}
    </div>
  );
}
