import { useZodResolver } from '@flama/frontend-web';
import { updateProfileSchema } from '@flama/shared/schemas/profile';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';

const nameSchema = updateProfileSchema
  .pick({ firstName: true, lastName: true })
  .required({ firstName: true, lastName: true });

export type NameFormValues = z.infer<typeof nameSchema>;

/**
 * The person's first and last name, beside the email they sign in with. The
 * design has no save button: a name is saved when its field loses focus with
 * a valid change in it, and `values` puts the saved name back after a save
 * (or a refetch), so the fields never drift from the server.
 */
export function NameForm({
  saved,
  email,
  onSave,
}: {
  saved: NameFormValues;
  email: string;
  onSave: (values: NameFormValues) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NameFormValues>({
    resolver: useZodResolver(nameSchema),
    values: saved,
    mode: 'onBlur',
  });
  const save = handleSubmit((values) => {
    if (values.firstName !== saved.firstName || values.lastName !== saved.lastName) {
      onSave(values);
    }
  });

  return (
    <form className="ds-fields-2" onSubmit={save} noValidate>
      <label className="ds-field">
        <span className="ds-label">{t('settings.profile.firstName')}</span>
        <input
          {...register('firstName', { onBlur: save })}
          className="ds-text-field ds-text-field--sm"
          autoComplete="given-name"
          aria-invalid={Boolean(errors.firstName)}
        />
      </label>
      <label className="ds-field">
        <span className="ds-label">{t('settings.profile.lastName')}</span>
        <input
          {...register('lastName', { onBlur: save })}
          className="ds-text-field ds-text-field--sm"
          autoComplete="family-name"
          aria-invalid={Boolean(errors.lastName)}
        />
      </label>
      {/* Better Auth owns the email: it is shown, not edited, here. */}
      <label className="ds-field ds-field--wide">
        <span className="ds-label">{t('settings.profile.email')}</span>
        <input className="ds-text-field ds-text-field--sm" type="email" value={email} readOnly />
      </label>
      <button type="submit" hidden />
    </form>
  );
}
