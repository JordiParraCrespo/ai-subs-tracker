import { Alert, AlertDescription } from '@flama/design-system-web';

/** Why a step of the security dialog failed, kept on screen under its header. */
export function StepError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="px-6 pb-4">
      <Alert variant="destructive">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
}
