import {
  AppWindow,
  Calendar,
  Gauge,
  ListOrdered,
  type LucideIcon,
  Receipt,
  Terminal,
} from '@flama/design-system-web/icons';
import type { FeatureIcon as FeatureIconName } from '../lib/content';

const ICONS: Record<FeatureIconName, LucideIcon> = {
  gauge: Gauge,
  'list-ordered': ListOrdered,
  receipt: Receipt,
  terminal: Terminal,
  calendar: Calendar,
  'app-window': AppWindow,
};

/** A feature's mark on the design system's disc (`.ds-disc`). */
export function FeatureIcon({ name }: { name: FeatureIconName }) {
  const Icon = ICONS[name];
  return (
    <span className="ds-disc site-feature__disc" aria-hidden="true">
      <Icon size={20} />
    </span>
  );
}
