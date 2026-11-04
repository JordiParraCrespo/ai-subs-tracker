import { Field, FieldError, FieldGroup, FieldLabel, Input } from '@flama/design-system-web';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useZodResolver } from '@flama/frontend-web';
import { type RecordUsageFormValues, recordUsageFormSchema } from '@flama/shared/schemas/accounts';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** `YYYY-MM-DDTHH:mm` in local time, what a `datetime-local` input holds. */
function localInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * A usage reading copied from the vendor's page: percent of the 5-hour and
 * weekly allowances used, and when the week resets. Starts from the last
 * reading's weekly reset, which rarely changes. The dialog renders the submit
 * button and points it at `id`.
 */
export function RecordUsageForm({
  id,
  account,
  isPending,
  onSubmit,
}: {
  id: string;
  account: AccountEntity;
  isPending: boolean;
  onSubmit: (values: RecordUsageFormValues) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RecordUsageFormValues>({
    resolver: useZodResolver(recordUsageFormSchema),
    defaultValues: {
      session: '',
      weekly: '',
      weeklyResetsAt: localInputValue(account.window('weekly')?.resetsAt ?? null),
    },
  });

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.session)}>
          <FieldLabel htmlFor={`${id}-session`}>{t('accounts.record.session')}</FieldLabel>
          <Input
            {...register('session')}
            id={`${id}-session`}
            inputMode="decimal"
            aria-invalid={Boolean(errors.session)}
            disabled={isPending}
          />
          <FieldError errors={[errors.session]} />
        </Field>
        <Field data-invalid={Boolean(errors.weekly)}>
          <FieldLabel htmlFor={`${id}-weekly`}>{t('accounts.record.weekly')}</FieldLabel>
          <Input
            {...register('weekly')}
            id={`${id}-weekly`}
            inputMode="decimal"
            aria-invalid={Boolean(errors.weekly)}
            disabled={isPending}
          />
          <FieldError errors={[errors.weekly]} />
        </Field>
        <Field data-invalid={Boolean(errors.weeklyResetsAt)}>
          <FieldLabel htmlFor={`${id}-resets`}>{t('accounts.record.weeklyResetsAt')}</FieldLabel>
          <Input
            {...register('weeklyResetsAt')}
            id={`${id}-resets`}
            type="datetime-local"
            aria-invalid={Boolean(errors.weeklyResetsAt)}
            disabled={isPending}
          />
          <FieldError errors={[errors.weeklyResetsAt]} />
        </Field>
      </FieldGroup>
    </form>
  );
}
