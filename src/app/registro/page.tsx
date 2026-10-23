import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth-screen';
import { isDemoEnabled } from '@/lib/demo-availability';

export const metadata: Metadata = { title: 'Registro' };

export default function RegisterPage() {
  return <AuthScreen mode="register" demoEnabled={isDemoEnabled()} />;
}
