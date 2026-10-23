import { AuthScreen } from '@/components/auth-screen';
import { isDemoEnabled } from '@/lib/demo-availability';

export default function ResetPasswordPage() {
  return <AuthScreen mode="update-password" demoEnabled={isDemoEnabled()} />;
}
