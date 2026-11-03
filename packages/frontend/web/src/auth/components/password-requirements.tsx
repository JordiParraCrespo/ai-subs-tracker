import { cn } from '@flama/design-system-web';
import { Circle, CircleCheck } from '@flama/design-system-web/icons';
import { checkPassword, meetsPasswordRequirements, type PasswordRule } from '@flama/frontend-core';
import { useTranslation } from 'react-i18next';

export { checkPassword, meetsPasswordRequirements as meetsRequirements, type PasswordRule };

/**
 * The live checklist under a password field, as the design draws it: an
 * open circle per rule, which turns into a check in the positive colour once
 * the rule passes.
 */
export function PasswordRequirements({
  results,
  rules,
  className,
}: {
  results: Record<PasswordRule, boolean>;
  rules: readonly PasswordRule[];
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <ul className={cn('m-0 flex list-none flex-col gap-2 p-0', className)}>
      {rules.map((rule) => {
        const passed = results[rule];
        const Icon = passed ? CircleCheck : Circle;
        return (
          <li
            key={rule}
            className={cn('ds-text-label flex items-center gap-2', passed ? 'ds-t-up' : 'ds-muted')}
          >
            <Icon className="size-4 flex-none" strokeWidth={1.5} aria-hidden />
            {t(`auth.passwordRules.${rule}`)}
          </li>
        );
      })}
    </ul>
  );
}
