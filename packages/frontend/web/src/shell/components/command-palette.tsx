import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@flama/design-system-web';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthorizedNav } from '../hooks/use-authorized-nav';
import { useHotkey } from '../hooks/use-hotkey';
import { useShell } from '../hooks/use-shell';

/** A row's value up to this mark is what it is matched on; after it, what makes it unique. */
export const COMMAND_VALUE_KEY = '\u0000';

/**
 * Plain substring matching, as the design's search does: cmdk's fuzzy score
 * lets "codex" match "Claude Code … example.com" letter by letter.
 */
function containsFilter(value: string, search: string, keywords?: string[]): number {
  const text = [value.split(COMMAND_VALUE_KEY)[0], ...(keywords ?? [])].join(' ').toLowerCase();
  return text.includes(search.trim().toLowerCase()) ? 1 : 0;
}

/**
 * ⌘K, as the design draws it: the app's own records first (what
 * `commandResults` renders), then every page — the sidebar's destinations and
 * the account menu's, from the same nav model, so the two can never disagree.
 * cmdk filters the rows by what is typed.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { commandResults: Results, userMenuLinks = [] } = useShell();
  const [query, setQuery] = useState('');
  const close = () => {
    onOpenChange(false);
    setQuery('');
  };

  useHotkey(() => (open ? close() : onOpenChange(true)));

  // Same authorized set the sidebar renders, so the palette can never jump to a
  // route the user is not allowed to open.
  const pages = [...useAuthorizedNav(), ...userMenuLinks];

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={t('nav.commandTitle')}
      description={t('nav.commandPlaceholder')}
      className="ds-palette"
      filter={containsFilter}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('nav.commandPlaceholder')}
        wrapperClassName="ds-palette__search"
        hint={<span className="ds-palette__esc">esc</span>}
      />
      <CommandList>
        <CommandEmpty>
          <span className="ds-label-strong">{t('nav.commandNoResults', { query })}</span>
          <span className="ds-t-sub">{t('nav.commandTry')}</span>
        </CommandEmpty>
        {Results && <Results onDone={close} />}
        <CommandGroup heading={t('nav.goTo')}>
          {pages.map((entry) => {
            const Icon = entry.icon;
            return (
              <CommandItem
                key={entry.to}
                value={t(`nav.${entry.labelKey}`)}
                onSelect={() => {
                  close();
                  navigate({ to: entry.to });
                }}
              >
                <span className="ds-disc ds-palette__disc">
                  <Icon />
                </span>
                {t(`nav.${entry.labelKey}`)}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
      <div className="ds-palette__foot">
        <span className="ds-t-sub">{t('nav.commandMove')}</span>
        <span className="ds-t-sub">{t('nav.commandOpen')}</span>
        <span className="ds-t-sub">{t('nav.commandClose')}</span>
      </div>
    </CommandDialog>
  );
}
