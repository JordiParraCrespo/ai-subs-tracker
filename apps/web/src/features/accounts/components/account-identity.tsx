import { Avatar, AvatarFallback } from '@flama/design-system-web';
import type { AccountEntity } from '@flama/frontend-consumer';
import { PROVIDER_NAMES } from '../lib/providers';

/** Avatar, name and "Provider · Plan" — the left cell of every account row. */
export function AccountIdentity({ account }: { account: AccountEntity }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar size="sm">
        <AvatarFallback gradient={account.provider === 'codex' ? 'teal' : 'purple'}>
          {account.initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-ink-900">{account.displayName}</div>
        <div className="truncate text-xs text-ink-600">
          {PROVIDER_NAMES[account.provider]}
          {account.planName ? ` · ${account.planName}` : ''}
        </div>
      </div>
    </div>
  );
}
