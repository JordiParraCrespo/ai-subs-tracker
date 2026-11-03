import { useMatches } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import '../lib/legal-note';

export interface AuthLayoutProps {
  /** The wordmark's label; defaults to the product name. */
  brandLabel?: string;
  /** The top bar's right-hand side, beside the wordmark. */
  action?: ReactNode;
  /**
   * The line under the form, after its legal note: the design's "New here?
   * Create account" and "Have an account? Sign in".
   */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * The design's auth frame: the wordmark and one contextual action in a top
 * bar, and a single 440px column centred on the frame's ground, always in
 * the dark palette. An app's
 * `_auth` route mounts this around its `Outlet`. It is chrome, not a gate: who
 * may be here is each child route's own `beforeLoad`, so one layout can cover
 * screens with opposite answers.
 */
export function AuthLayout({ brandLabel, action, footer, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  // The innermost match that declares a note wins, so a page overrides its
  // layout and a page without one shows nothing.
  const legalNoteKey = useMatches({
    select: (matches) => {
      for (let i = matches.length - 1; i >= 0; i -= 1) {
        const key = matches[i]?.staticData.legalNoteKey;
        if (key) return key;
      }
      return undefined;
    },
  });

  // `dark` on the frame, whatever the app's theme: the design draws these
  // screens on the dark frame only, and its light theme keeps that frame dark,
  // so light-theme ink on it was unreadable.
  return (
    <div className="dark flex h-svh w-full flex-col overflow-y-auto bg-frame text-ink-900 scheme-dark">
      <header className="flex items-center justify-between gap-4 px-6 py-6 sm:px-8">
        <span className="ds-wordmark">{brandLabel ?? t('common.appName')}</span>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </header>
      <main className="grid flex-1 place-items-center px-6 pt-6 pb-24">
        <div className="flex w-110 max-w-full flex-col">
          {children}
          {legalNoteKey && (
            <p className="ds-text-label ds-subtle m-0 mt-4 text-center text-pretty">
              {t(legalNoteKey)}
            </p>
          )}
          {footer && <div className="mt-6 flex items-center justify-center gap-1">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
