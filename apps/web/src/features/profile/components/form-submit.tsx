import { DsButton } from '@flama/design-system-web';
import { type Control, type FieldValues, useWatch } from 'react-hook-form';

/**
 * A footer button that says what the form still needs ("Add a number") until
 * it is ready, then what submitting does. It watches the form itself, so a
 * keystroke re-renders this button and not the fields above it.
 */
export function FormSubmit<T extends FieldValues>({
  control,
  form,
  pending,
  cta,
}: {
  control: Control<T>;
  /** The id of the form the button submits from outside it. */
  form: string;
  pending: boolean;
  cta: (values: Partial<T>) => { label: string; ready: boolean };
}) {
  const values = useWatch({ control }) as Partial<T>;
  const { label, ready } = cta(values);
  return (
    <DsButton variant="primary" size="sm" type="submit" form={form} disabled={!ready || pending}>
      {label}
    </DsButton>
  );
}
