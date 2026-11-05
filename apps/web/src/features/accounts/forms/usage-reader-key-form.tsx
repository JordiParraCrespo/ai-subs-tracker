import { Field, FieldDescription, FieldError, FieldLabel, Input } from '@flama/design-system-web';
import { useZodResolver } from '@flama/frontend-web';
import {
  type UsageReaderKeyFormValues,
  usageReaderKeyFormSchema,
} from '@flama/shared/schemas/accounts';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The Coding Plan key that turns on automatic reading. Never prefilled: the
 * desktop app keeps the key and never hands it back. The dialog renders the
 * submit button and points it at `id`.
 */
export function UsageReaderKeyForm({
  id,
  name,
  isPending,
  onSubmit,
}: {
  id: string;
  /** The vendor, as the person knows it: Z.AI, BigModel. */
  name: string;
  isPending: boolean;
  onSubmit: (values: UsageReaderKeyFormValues) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UsageReaderKeyFormValues>({
    resolver: useZodResolver(usageReaderKeyFormSchema),
    defaultValues: { apiKey: '' },
  });

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field data-invalid={Boolean(errors.apiKey)}>
        <FieldLabel htmlFor={`${id}-key`}>{t('accounts.reader.key', { name })}</FieldLabel>
        <Input
          {...register('apiKey')}
          id={`${id}-key`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(errors.apiKey)}
          disabled={isPending}
        />
        <FieldDescription>{t('accounts.reader.keyHelp', { name })}</FieldDescription>
        <FieldError errors={[errors.apiKey]} />
      </Field>
    </form>
  );
}
