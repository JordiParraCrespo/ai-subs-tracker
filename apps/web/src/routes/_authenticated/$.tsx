import { NotFoundScreen } from '@flama/frontend-web';
import { createFileRoute } from '@tanstack/react-router';

/** Any address the app has no page for, signed in: the 404 inside the shell. */
export const Route = createFileRoute('/_authenticated/$')({
  component: () => <NotFoundScreen home="/dashboard" />,
});
