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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@flama/design-system-web';
import type { AccountEntity } from '@flama/frontend-consumer';
import { useZodResolver } from '@flama/frontend-web';
import { type EditAccountFormValues, editAccountFormSchema } from '@flama/shared/schemas/accounts';
import { plansFor } from '@flama/shared/subscriptions';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { reportedPlanName } from '../lib/plan-name';

/** The form's value for "use what the provider reports". */
const AUTO_PLAN = '';
/**
 * The same choice as the select holds it. Base UI reads an empty string as
 * "nothing picked" and greys the trigger as a placeholder, though "As reported"
 * is a real answer.
 */
const AUTO_OPTION = 'reported';

/**
 * An account's own name, who uses it, its plan, price and billing day. The dialog renders the submit
 * button and points it at `id`.
 */
export function EditAccountForm({
  id,
  account,
  people,
  isPending,
  onSubmit,
}: {
  id: string;
  account: AccountEntity;
  /** The names already given to other accounts, offered as the person types. */
  people: readonly string[];
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
      person: account.person ?? '',
      planId:
        account.planOverridden || account.isManual ? (account.planId ?? AUTO_PLAN) : AUTO_PLAN,
      price: account.priceOverridden ? (account.monthlyPriceCents / 100).toFixed(2) : '',
      renewalDay: account.renewalDay === null ? '' : String(account.renewalDay),
    },
  });
  // A hand-tracked plan has no reported one to fall back on.
  const reported = reportedPlanName(account.provider, account.reportedPlan);
  const autoLabel = account.isManual
    ? null
    : reported
      ? t('accounts.edit.planAuto', { plan: reported })
      : t('accounts.edit.planAutoNone');
  const planLabels: Record<string, string> = {
    ...(autoLabel ? { [AUTO_OPTION]: autoLabel } : {}),
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
        <Field data-invalid={Boolean(errors.person)}>
          <FieldLabel htmlFor={`${id}-person`}>{t('accounts.edit.person')}</FieldLabel>
          <Input
            {...register('person')}
            id={`${id}-person`}
            list={people.length ? `${id}-people` : undefined}
            placeholder={t('accounts.edit.personPlaceholder')}
            aria-invalid={Boolean(errors.person)}
            disabled={isPending}
          />
          {people.length > 0 && (
            <datalist id={`${id}-people`}>
              {people.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
          <FieldDescription>{t('accounts.edit.personHint')}</FieldDescription>
          <FieldError errors={[errors.person]} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-plan`}>{t('accounts.edit.plan')}</FieldLabel>
          <Controller
            control={control}
            name="planId"
            render={({ field }) => (
              <Select
                items={planLabels}
                value={field.value === AUTO_PLAN ? AUTO_OPTION : field.value}
                disabled={isPending}
                onValueChange={(next) =>
                  field.onChange(!next || next === AUTO_OPTION ? AUTO_PLAN : next)
                }
              >
                <SelectTrigger id={`${id}-plan`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {autoLabel && (
                    <>
                      <SelectItem value={AUTO_OPTION}>{autoLabel}</SelectItem>
                      <SelectSeparator />
                    </>
                  )}
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
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
