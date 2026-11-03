import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

interface WorkspaceNameValues {
  name: string;
}

/**
 * The workspace's name, saved when the field loses focus with a change in it.
 * An emptied field clears the name, and the sidebar goes back to the person's.
 */
export function WorkspaceNameForm({
  saved,
  onSave,
}: {
  saved: string | null;
  onSave: (name: string | null) => void;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit } = useForm<WorkspaceNameValues>({
    values: { name: saved ?? '' },
    resetOptions: { keepDirtyValues: true },
  });
  const save = handleSubmit(({ name }) => {
    const next = name.trim().slice(0, 80) || null;
    if (next !== saved) onSave(next);
  });

  return (
    <form onSubmit={save} noValidate>
      <label className="ds-field">
        <span className="ds-label">{t('settings.workspace.name')}</span>
        <input
          {...register('name', { onBlur: save })}
          maxLength={80}
          placeholder={t('settings.workspace.placeholder')}
          className="ds-text-field ds-text-field--sm"
        />
      </label>
    </form>
  );
}
