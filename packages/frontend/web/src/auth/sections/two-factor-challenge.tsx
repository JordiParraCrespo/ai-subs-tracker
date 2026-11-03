import type { TwoFactorMethod } from '@flama/frontend-core';
import { useErrorMessage, useVerifyTwoFactor } from '@flama/frontend-core/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthSubtitle, AuthTitle } from '../components/auth-primitives';
import { TwoFactorChallengeForm } from '../forms/two-factor-challenge-form';

/**
 * The code step of a password sign-in, whole: heading, form and the
 * verification it owns. Both web apps' login screens render it in place of
 * the password form while `useLogin` holds `isTwoFactorRequired`, so the
 * challenge lives here once rather than in each screen.
 */
export function TwoFactorChallenge({
  onSuccess,
  onCancel,
}: {
  /** The session exists: go where the password sign-in would have gone. */
  onSuccess: () => void;
  /** Back to the password step; the screen forgets the attempt. */
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const verify = useVerifyTwoFactor({ onSuccess });
  // The heading follows the method, so the method lives here, above the form.
  const [method, setMethod] = useState<TwoFactorMethod>('totp');
  const backup = method === 'backup-code';

  return (
    <>
      <AuthTitle>{t(backup ? 'auth.twoFactor.backupTitle' : 'auth.twoFactor.title')}</AuthTitle>
      <AuthSubtitle>
        {t(backup ? 'auth.twoFactor.backupDescription' : 'auth.twoFactor.description', {
          app: t('common.appName'),
        })}
      </AuthSubtitle>

      <TwoFactorChallengeForm
        method={method}
        onMethodChange={(next) => {
          setMethod(next);
          verify.reset();
        }}
        isPending={verify.isPending}
        error={
          verify.error
            ? resolveError(verify.error, t('auth.twoFactor.invalidCode')).message
            : undefined
        }
        onSubmit={(values) => verify.mutate(values)}
        onCancel={onCancel}
      />
    </>
  );
}
