import { DsAvatar } from '@flama/design-system-web';
import { ChevronRight } from '@flama/design-system-web/icons';

/** One tool in the add-subscription list: its mark, its name, how it signs in. */
export function ProviderPickRow({
  name,
  how,
  initials,
  color,
  onPick,
}: {
  name: string;
  how: string;
  initials: string;
  color: string;
  onPick: () => void;
}) {
  return (
    <button type="button" className="ds-pick-row" onClick={onPick}>
      <DsAvatar initials={initials} color={color} size={40} />
      <span className="ds-pick-row__meta">
        <span className="ds-label-strong">{name}</span>
        <span className="ds-t-sub">{how}</span>
      </span>
      <span className="ds-pick-row__chevron">
        <ChevronRight className="size-4" />
      </span>
    </button>
  );
}
