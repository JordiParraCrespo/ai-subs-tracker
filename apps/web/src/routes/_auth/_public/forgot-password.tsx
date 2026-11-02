import { createFileRoute } from '@tanstack/react-router';
import { ForgotPasswordScreen } from '@/features/auth/screens/forgot-password';

export const Route = createFileRoute('/_auth/_public/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
