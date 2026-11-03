import { DsButton } from '@flama/design-system-web';
import { ArrowLeft, CircleCheck, ClockAlert, MailCheck } from '@flama/design-system-web/icons';
import { useForgotPassword, useResetPassword } from '@flama/frontend-core/react';
import {
  AuthIconCircle,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
  useErrorMessage,
} from '@flama/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ResetPasswordForm } from '@/features/auth/forms/reset-password-form';

/**
 * Where the reset email's link lands: choose a new password, or, when the
 * link is spent or expired, send a new one; then "Password changed". The API
 * revokes every session on a reset, which is what the last screen says.
 */
export function ResetPasswordScreen({
  token,
  linkError,
  email,
}: {
  token?: string;
  linkError?: string;
  email?: string;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error } = useResetPassword();
  const resend = useForgotPassword();
  const [done, setDone] = useState(false);

  if (resend.isSuccess && email) {
    return (
      <>
        <AuthIconCircle>
          <MailCheck />
        </AuthIconCircle>
        <AuthTitle>{t('auth.forgotPassword.successTitle')}</AuthTitle>
        <AuthSubtitle>
          <Trans
            i18nKey="auth.forgotPassword.sentMessage"
            values={{ email }}
            components={{ address: <strong className="font-medium text-ink-900" /> }}
          />
        </AuthSubtitle>
        <Link to="/login" className={authControlClass}>
          {t('auth.forgotPassword.backToSignIn')}
        </Link>
      </>
    );
  }

  if (!token || linkError) {
    return (
      <>
        <AuthIconCircle>
          <ClockAlert />
        </AuthIconCircle>
        <AuthTitle>{t('auth.resetPassword.expiredTitle')}</AuthTitle>
        <AuthSubtitle>
          {email
            ? t('auth.resetPassword.expiredText', { email })
            : t('auth.resetPassword.expiredTextNoEmail')}
        </AuthSubtitle>
        {email ? (
          <DsButton
            size="md"
            block
            disabled={resend.isPending}
            onClick={() => resend.mutate(email)}
          >
            {t('auth.resetPassword.sendNew')}
          </DsButton>
        ) : (
          <Link to="/forgot-password" className={authControlClass}>
            {t('auth.resetPassword.sendNew')}
          </Link>
        )}
        <Link to="/login" className="ds-btn ds-btn--text mt-7 self-center">
          <ArrowLeft className="size-4" />
          {t('auth.forgotPassword.backToSignIn')}
        </Link>
      </>
    );
  }

  if (done) {
    return (
      <>
        <AuthIconCircle>
          <CircleCheck />
        </AuthIconCircle>
        <AuthTitle>{t('auth.resetPassword.changedTitle')}</AuthTitle>
        <AuthSubtitle>{t('auth.resetPassword.changedText')}</AuthSubtitle>
        <Link to="/login" className={authControlClass}>
          {t('auth.resetPassword.signIn')}
        </Link>
      </>
    );
  }

  return (
    <>
      <AuthTitle>{t('auth.resetPassword.title')}</AuthTitle>
      <AuthSubtitle>
        {email ? t('auth.resetPassword.forEmail', { email }) : t('auth.resetPassword.description')}
      </AuthSubtitle>
      <ResetPasswordForm
        isPending={isPending}
        error={error ? resolveError(error, t('auth.resetPassword.error')).message : undefined}
        onSubmit={(values) =>
          mutate({ token, password: values.password }, { onSuccess: () => setDone(true) })
        }
      />
    </>
  );
}
