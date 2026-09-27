import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth-screen';

export const metadata: Metadata = { title: 'Recuperar acceso' };

export default function RecoverPage() {
  return <AuthScreen mode="recover" />;
}
