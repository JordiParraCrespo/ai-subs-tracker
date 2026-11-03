import { DsButton } from '@flama/design-system-web';
import type { TwoFactorMethod } from '@flama/frontend-core';
import type { TwoFactorChallengeDto } from '@flama/shared/schemas/auth';
import { type Control, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** Characters a code needs before it can be sent: six digits, or a backup code. */
const NEEDED: Record<TwoFactorMethod, number> = { totp: 6, 'backup-code': 9 };

/**
 * The design's verify button: quiet and naming what is missing until the code
 * is long enough to try, then "Verify". It subscribes to the code itself, so
 * typing redraws only the button.
 */
export function TwoFactorSubmit({
  control,
  method,
  isPending,
}: {
  control: Control<TwoFactorChallengeDto>;
  method: TwoFactorMethod;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const code = useWatch({ control, name: 'code' }) ?? '';
  const short = code.replace(/\s/g, '').length < NEEDED[method];
  const label = isPending
    ? t('auth.twoFactor.verifying')
    : short
      ? t(method === 'totp' ? 'auth.twoFactor.needCode' : 'auth.twoFactor.needBackupCode')
      : t('auth.twoFactor.verify');
  return (
    <DsButton type="submit" variant="primary" size="md" block disabled={isPending || short}>
      {label}
    </DsButton>
  );
}
