import { DsModal } from '@flama/design-system-web';
import { useState } from 'react';
import { ChangePasswordStep } from '@/features/profile/dialogs/change-password';
import { SignOutDeviceStep } from '@/features/profile/dialogs/sign-out-device';
import { SignOutOthersStep } from '@/features/profile/dialogs/sign-out-others';
import { TwoFactorOffStep } from '@/features/profile/dialogs/two-factor-off';
import { TwoFactorOnStep } from '@/features/profile/dialogs/two-factor-on';
import type { SecurityStep } from '@/features/profile/lib/security-steps';
import { SecurityOverview } from '@/features/profile/sections/security-overview';

/**
 * The design's Security dialog: one modal that stays open while it moves
 * from the overview to a flow and back, each flow owning its own mutation.
 */
export function SecurityDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<SecurityStep>({ kind: 'overview' });
  const home = () => setStep({ kind: 'overview' });

  return (
    <DsModal open onOpenChange={(open) => !open && onClose()}>
      {step.kind === 'overview' && <SecurityOverview onStep={setStep} />}
      {step.kind === 'password' && <ChangePasswordStep onBack={home} />}
      {step.kind === 'two-factor-on' && <TwoFactorOnStep onBack={home} />}
      {step.kind === 'two-factor-off' && <TwoFactorOffStep onBack={home} />}
      {step.kind === 'sign-out' && <SignOutDeviceStep session={step.session} onBack={home} />}
      {step.kind === 'sign-out-others' && <SignOutOthersStep count={step.count} onBack={home} />}
    </DsModal>
  );
}
