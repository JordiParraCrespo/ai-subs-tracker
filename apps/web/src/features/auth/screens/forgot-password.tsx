import { DsButton } from '@flama/design-system-web';
import { MailCheck } from '@flama/design-system-web/icons';
import { useForgotPassword } from '@flama/frontend-core/react';
import {
  AuthBackLink,
  AuthIconCircle,
  AuthSubtitle,
  AuthTitle,
  authControlClass,
  useErrorMessage,
} from '@flama/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ForgotPasswordForm } from '@/features/auth/forms/forgot-password-form';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { mutate, isPending, error } = useForgotPassword();

  // Held locally rather than read off the mutation, so a resend's own
  // pending and success do not move the screen.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  if (sentTo) {
    return (
      <>
        <AuthIconCircle>
          <MailCheck />
        </AuthIconCircle>
        <AuthTitle>{t('auth.forgotPassword.successTitle')}</AuthTitle>
        <AuthSubtitle>
          <Trans
            i18nKey="auth.forgotPassword.sentMessage"
            values={{ email: sentTo }}
            components={{ address: <strong className="font-medium text-ink-900" /> }}
          />
        </AuthSubtitle>
        <Link to="/login" className={authControlClass}>
          {t('auth.forgotPassword.backToSignIn')}
        </Link>
        <div className="mt-7 flex items-center justify-center gap-1.5">
          <span className="ds-cell-sub">{t('auth.forgotPassword.didntGet')}</span>
          <DsButton
            size="text"
            disabled={resent || isPending}
            onClick={() => mutate(sentTo, { onSuccess: () => setResent(true) })}
          >
            {resent ? t('auth.forgotPassword.resent') : t('auth.forgotPassword.resend')}
          </DsButton>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthTitle>{t('auth.forgotPassword.title')}</AuthTitle>
      <AuthSubtitle>{t('auth.forgotPassword.description')}</AuthSubtitle>

      <ForgotPasswordForm
        isPending={isPending}
        error={error ? resolveError(error, t('auth.forgotPassword.error')).message : undefined}
        onSubmit={({ email }) => mutate(email, { onSuccess: () => setSentTo(email) })}
      />

      <AuthBackLink />
    </>
  );
}
