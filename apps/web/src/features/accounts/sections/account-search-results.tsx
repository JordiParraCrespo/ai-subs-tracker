import { CommandGroup, CommandItem, DsAvatar } from '@flama/design-system-web';
import { useAccounts } from '@flama/frontend-consumer/react';
import { COMMAND_VALUE_KEY } from '@flama/frontend-web';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { accountMark, accountTitle } from '../lib/marks';

/**
 * ⌘K's Subscriptions group: every tracked account, matched on its name, plan,
 * provider and email, opening that provider's page.
 */
export function AccountSearchResults({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  if (accounts.length === 0) return null;

  return (
    <CommandGroup heading={t('accounts.search.group')}>
      {accounts.map((account) => {
        const mark = accountMark(account);
        const title = account.label ?? accountTitle(account);
        return (
          <CommandItem
            key={account.id}
            value={`${title}${COMMAND_VALUE_KEY}${account.id}`}
            keywords={[accountTitle(account), account.email ?? '']}
            onSelect={() => {
              onDone();
              navigate({ to: '/accounts/$provider', params: { provider: account.provider } });
            }}
          >
            <DsAvatar initials={mark.initials} color={mark.color} size={28} />
            <span className="ds-palette__label">{title}</span>
            {account.email && <span className="ds-t-sub ds-palette__meta">{account.email}</span>}
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}
