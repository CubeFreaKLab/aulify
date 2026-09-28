import { redirect } from 'next/navigation';
import { Workspace } from '@/components/workspace';
import { createSupabaseServer } from '@/lib/supabase/server';
import { hasSupabaseConfig } from '@/lib/supabase/config';

export default async function AulaLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseConfig()) redirect('/acceso?error=configuracion');
  const client = await createSupabaseServer();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect('/acceso');
  return (
    <>
      <Workspace />
      {children}
    </>
  );
}
