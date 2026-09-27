import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth-screen';

export const metadata: Metadata = { title: 'Acceso' };

export default function AccessPage() {
  return <AuthScreen mode="access" />;
}
