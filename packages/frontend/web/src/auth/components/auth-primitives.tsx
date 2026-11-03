import {
  Alert,
  AlertDescription,
  cn,
  Field,
  FieldError,
  FieldLabel,
} from '@flama/design-system-web';
import { ArrowLeft } from '@flama/design-system-web/icons';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The shared vocabulary of the auth screens, expressed once so every page
 * inherits the same type ramp and rhythm as the design's auth screens:
 * 24px/500 title, 14px muted subtitle, 14px labels, 40px fields and actions.
 */

/**
 * Full-width actions on these screens are the design's 40px button
 * (`.ds-btn--md`), for the places a link has to look like one.
 */
export const authControlClass = 'ds-btn ds-btn--md ds-btn--block';

/** Inputs are the design's 40px text field (`.ds-input`), drawn on the bare element. */
export const authInputClass = 'ds-text-field';

export function AuthEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-sm font-medium text-accent-blue">{children}</p>;
}

/**
 * `font-sans` overrides the design system's display cut for headings: these
 * screens are set entirely in the text cut, whose wider letterforms are what
 * decide where a title wraps.
 */
export function AuthTitle({ children, className }: React.ComponentProps<'h1'>) {
  return <h1 className={cn('ds-title-lg m-0 mb-1.5 text-pretty', className)}>{children}</h1>;
}

export function AuthSubtitle({ children, className }: React.ComponentProps<'p'>) {
  return <p className={cn('ds-text-label ds-muted m-0 mb-7 text-pretty', className)}>{children}</p>;
}

/** The 52px brand disc that heads a terminal state (mail sent, password updated). */
export function AuthIconCircle({ children }: { children: React.ReactNode }) {
  return <div className="ds-disc ds-disc--lg mb-7 [&>svg]:size-6">{children}</div>;
}

/** A pill naming the address a flow is scoped to. */
export function AuthEmailChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-7 inline-flex self-start items-center gap-2 rounded-full border border-border-subtle bg-surface-sunken px-3 py-2 text-sm text-ink-900 [&>svg]:size-[15px] [&>svg]:text-ink-600 [&>svg]:opacity-55">
      {children}
    </div>
  );
}

/** Hairline · label · hairline, as used between the CTA and social sign-in. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="ds-text-label ds-subtle my-7 flex items-center gap-3">
      <span className="ds-hairline" />
      {label}
      <span className="ds-hairline" />
    </div>
  );
}

export function AuthBackLink({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();

  return (
    <Link to="/login" className="ds-btn ds-btn--text mt-7 self-center">
      <ArrowLeft className="size-4" />
      {children ?? t('auth.forgotPassword.backToSignIn')}
    </Link>
  );
}

/** The centred "Already have an account? Sign in" line at the foot of a form. */
export function AuthFooterNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-7 text-center text-sm text-ink-600">{children}</p>;
}

/**
 * Failed submissions surface here, above the first field. The design system's
 * `Alert` carries the destructive treatment and the `role="alert"` — this
 * wrapper only exists so the auth screens name the slot in their own
 * vocabulary.
 */
export function AuthFormError({ children }: { children: React.ReactNode }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/**
 * Label + control + error, at the auth screens' 7px label gap. Wraps the
 * design system's `Field` so validation state and `data-invalid` behave
 * exactly as they do in the rest of the product.
 */
export function AuthField({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  error?: { message?: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Field className={cn('gap-0', className)} data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={htmlFor} className="ds-label">
        {label}
      </FieldLabel>
      {children}
      <FieldError errors={[error]} />
    </Field>
  );
}
