import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth-screen';

export const metadata: Metadata = { title: 'Acceso' };

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialStatus =
    params.password === 'updated'
      ? 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.'
      : params.error === 'enlace'
        ? 'El enlace ya no es válido. Solicita uno nuevo desde Recuperar acceso.'
        : params.error
          ? 'No pudimos iniciar la sesión. Inténtalo de nuevo.'
          : '';
  return <AuthScreen mode="access" initialStatus={initialStatus} />;
}
