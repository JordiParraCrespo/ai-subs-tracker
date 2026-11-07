import {
  Field,
  FieldDescription,
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
import { useLocale, useZodResolver } from '@flama/frontend-web';
import {
  type AddManualAccountFormValues,
  addManualAccountFormSchema,
} from '@flama/shared/schemas/accounts';
import { findPlan, type ManualProviderId, plansFor } from '@flama/shared/subscriptions';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/format';

/**
 * A subscription added by hand: its name, plan, price and billing day. No
 * field for a key or a token — ResetOwl tracks the plan, not the login. The
 * dialog renders the submit button and points it at `id`.
 */
export function AddManualAccountForm({
  id,
  provider,
  renewalDay,
  isPending,
  onSubmit,
}: {
  id: string;
  provider: ManualProviderId;
  /** The billing day to start from, e.g. the calendar day it was added from. */
  renewalDay?: number;
  isPending: boolean;
  onSubmit: (values: AddManualAccountFormValues) => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const plans = plansFor(provider);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddManualAccountFormValues>({
    resolver: useZodResolver(addManualAccountFormSchema),
    defaultValues: {
      label: '',
      email: '',
      planId: plans[0]?.id ?? '',
      price: '',
      renewalDay: renewalDay === undefined ? '' : String(renewalDay),
    },
  });
  const planId = useWatch({ control, name: 'planId' });
  const listPrice = findPlan(planId)?.monthlyPriceCents ?? null;
  const number = (value: number) => value.toLocaleString(locale);
  const planLabels: Record<string, string> = Object.fromEntries(
    plans.map((plan) => [
      plan.id,
      plan.allowance
        ? t('accounts.add.manual.planOption', {
            plan: plan.name,
            session: number(plan.allowance.session),
            weekly: number(plan.allowance.weekly),
          })
        : plan.name,
    ]),
  );

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.label)}>
          <FieldLabel htmlFor={`${id}-label`}>{t('accounts.add.manual.label')}</FieldLabel>
          <Input
            {...register('label')}
            id={`${id}-label`}
            placeholder={t('accounts.add.manual.labelPlaceholder')}
            aria-invalid={Boolean(errors.label)}
            disabled={isPending}
          />
          <FieldError errors={[errors.label]} />
        </Field>
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor={`${id}-email`}>{t('accounts.add.manual.email')}</FieldLabel>
          <Input
            {...register('email')}
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            disabled={isPending}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-plan`}>{t('accounts.add.manual.plan')}</FieldLabel>
          <Controller
            control={control}
            name="planId"
            render={({ field }) => (
              <Select
                items={planLabels}
                value={field.value}
                disabled={isPending}
                onValueChange={(next) => next && field.onChange(next)}
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
          <FieldLabel htmlFor={`${id}-price`}>{t('accounts.add.manual.price')}</FieldLabel>
          <Input
            {...register('price')}
            id={`${id}-price`}
            inputMode="decimal"
            placeholder={
              listPrice === null
                ? ''
                : t('accounts.add.manual.priceList', { price: formatMoney(listPrice, locale) })
            }
            aria-invalid={Boolean(errors.price)}
            disabled={isPending}
          />
          {listPrice === null && (
            <FieldDescription>{t('accounts.add.manual.priceRequired')}</FieldDescription>
          )}
          <FieldError errors={[errors.price]} />
        </Field>
        <Field data-invalid={Boolean(errors.renewalDay)}>
          <FieldLabel htmlFor={`${id}-renewal`}>{t('accounts.add.manual.renewalDay')}</FieldLabel>
          <Input
            {...register('renewalDay')}
            id={`${id}-renewal`}
            inputMode="numeric"
            placeholder={t('accounts.add.manual.renewalPlaceholder')}
            aria-invalid={Boolean(errors.renewalDay)}
            disabled={isPending}
          />
          <FieldError errors={[errors.renewalDay]} />
        </Field>
      </FieldGroup>
    </form>
  );
}
