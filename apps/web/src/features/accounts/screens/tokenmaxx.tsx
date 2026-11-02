import { PageHead } from '@flama/frontend-web';
import { useTranslation } from 'react-i18next';
import { PickNext } from '../sections/pick-next';
import { TokenmaxxQueue } from '../sections/tokenmaxx-queue';

/** Which account to use next so nothing you pay for expires unused. */
export function TokenmaxxScreen() {
  const { t } = useTranslation();

  return (
    <>
      <PageHead title={t('accounts.tokenmaxx.title')} sub={t('accounts.tokenmaxx.sub')} />
      <PickNext />
      <TokenmaxxQueue />
    </>
  );
}
