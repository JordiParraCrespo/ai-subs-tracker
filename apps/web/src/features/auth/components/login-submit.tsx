import { DsButton } from '@flama/design-system-web';
import { type LoginDto, loginSchema } from '@flama/shared/schemas/auth';
import { type Control, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The design's sign-in button: until the form can go, it stays quiet and
 * names the next thing missing ("Enter your email"); then it reads "Sign in".
 * It subscribes to the two fields itself, so typing redraws only the button.
 */
export function LoginSubmit({
  control,
  isPending,
}: {
  control: Control<LoginDto>;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [email, password] = useWatch({ control, name: ['email', 'password'] });
  const missing = !email
    ? t('auth.login.needEmail')
    : !loginSchema.shape.email.safeParse(email).success
      ? t('auth.login.needValidEmail')
      : !password
        ? t('auth.login.needPassword')
        : null;

  return (
    <DsButton
      type="submit"
      variant="primary"
      size="md"
      block
      disabled={isPending || missing !== null}
    >
      {isPending ? t('auth.login.submitting') : (missing ?? t('auth.login.submit'))}
    </DsButton>
  );
}
