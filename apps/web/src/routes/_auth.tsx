import { AuthLayout } from '@flama/frontend-web';
import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Everything a reader sees before the console: the sign-in screens under
 * `_public`. One layout, so the wordmark and the column do not drift apart
 * across the walk in.
 *
 * This route is chrome, not a gate. Its children want different answers to
 * "who may be here", so each carries its own `beforeLoad` and this one
 * carries none.
 */
export const Route = createFileRoute('/_auth')({
  component: ConsumerAuthLayout,
});

function ConsumerAuthLayout() {
  return (
    <AuthLayout action={<SwitchAction />}>
      <Outlet />
    </AuthLayout>
  );
}

/** The design's top-right: sign-in offers an account, sign-up offers sign-in. */
function SwitchAction() {
  const { t } = useTranslation();
  const pathname = useLocation({ select: (location) => location.pathname });
  if (pathname === '/login')
    return (
      <>
        <span className="ds-cell-sub">{t('auth.layout.newHere')}</span>
        <Link to="/register" className="ds-btn ds-btn--sm">
          {t('auth.layout.createAccount')}
        </Link>
      </>
    );
  if (pathname === '/register')
    return (
      <>
        <span className="ds-cell-sub">{t('auth.layout.haveAccount')}</span>
        <Link to="/login" className="ds-btn ds-btn--sm">
          {t('auth.layout.signIn')}
        </Link>
      </>
    );
  return null;
}
