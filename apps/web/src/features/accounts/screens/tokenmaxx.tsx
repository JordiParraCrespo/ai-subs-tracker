import { PageHead } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { TokenmaxxMoves } from '../sections/tokenmaxx-moves';
import { TokenmaxxPick } from '../sections/tokenmaxx-pick';
import { TokenmaxxQueue } from '../sections/tokenmaxx-queue';

/** Which account to use next so nothing you pay for expires unused, as the design lays it out. */
export function TokenmaxxScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <PageHead
        className="mb-0"
        title={t('accounts.tokenmaxx.title')}
        sub={t('accounts.tokenmaxx.sub')}
      />
      <TokenmaxxPick />
      <TokenmaxxQueue />
      <TokenmaxxMoves />
    </div>
  );
}
