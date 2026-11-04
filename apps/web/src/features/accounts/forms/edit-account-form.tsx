import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flama/design-system-web';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useZodResolver } from '@flama/frontend-web';
import { type EditAccountFormValues, editAccountFormSchema } from '@flama/shared/schemas/accounts';
import { plansFor } from '@flama/shared/subscriptions';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** The value of the "use what the provider reports" plan option. */
const AUTO_PLAN = '';

/**
 * An account's own name, plan, price and billing day. The dialog renders the submit
 * button and points it at `id`.
 */
export function EditAccountForm({
  id,
  account,
  isPending,
  onSubmit,
}: {
  id: string;
  account: AccountEntity;
  isPending: boolean;
  onSubmit: (values: EditAccountFormValues) => void;
}) {
  const { t } = useTranslation();
  const plans = plansFor(account.provider);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditAccountFormValues>({
    resolver: useZodResolver(editAccountFormSchema),
    defaultValues: {
      label: account.label ?? '',
      planId:
        account.planOverridden || account.isManual ? (account.planId ?? AUTO_PLAN) : AUTO_PLAN,
      price: account.priceOverridden ? (account.monthlyPriceCents / 100).toFixed(2) : '',
      renewalDay: account.renewalDay === null ? '' : String(account.renewalDay),
    },
  });
  // A hand-tracked plan has no reported one to fall back on.
  const planLabels: Record<string, string> = {
    ...(account.isManual
      ? {}
      : { [AUTO_PLAN]: t('accounts.edit.planAuto', { plan: account.reportedPlan ?? '—' }) }),
    ...Object.fromEntries(plans.map((plan) => [plan.id, plan.name])),
  };

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.label)}>
          <FieldLabel htmlFor={`${id}-label`}>{t('accounts.edit.label')}</FieldLabel>
          <Input
            {...register('label')}
            id={`${id}-label`}
            placeholder={account.email ?? ''}
            aria-invalid={Boolean(errors.label)}
            disabled={isPending}
          />
          <FieldError errors={[errors.label]} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-plan`}>{t('accounts.edit.plan')}</FieldLabel>
          <Controller
            control={control}
            name="planId"
            render={({ field }) => (
              <Select
                items={planLabels}
                value={field.value}
                disabled={isPending}
                onValueChange={(next) => field.onChange(next ?? AUTO_PLAN)}
              >
                <SelectTrigger id={`${id}-plan`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(planLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field data-invalid={Boolean(errors.price)}>
          <FieldLabel htmlFor={`${id}-price`}>{t('accounts.edit.price')}</FieldLabel>
          <Input
            {...register('price')}
            id={`${id}-price`}
            inputMode="decimal"
            placeholder={t('accounts.edit.pricePlaceholder')}
            aria-invalid={Boolean(errors.price)}
            disabled={isPending}
          />
          <FieldError errors={[errors.price]} />
        </Field>
        <Field data-invalid={Boolean(errors.renewalDay)}>
          <FieldLabel htmlFor={`${id}-renewal`}>{t('accounts.edit.renewalDay')}</FieldLabel>
          <Input
            {...register('renewalDay')}
            id={`${id}-renewal`}
            inputMode="numeric"
            placeholder={t('accounts.edit.renewalPlaceholder')}
            aria-invalid={Boolean(errors.renewalDay)}
            disabled={isPending}
          />
          <FieldError errors={[errors.renewalDay]} />
        </Field>
      </FieldGroup>
    </form>
  );
}
