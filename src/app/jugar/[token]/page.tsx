import { notFound } from 'next/navigation';
import { GuestPlayer } from '@/components/guest-player';
import { isDemoEnabled } from '@/lib/demo-availability';

export const metadata = { title: 'Jugar como invitado', robots: { index: false, follow: false } };
export default async function GuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token === 'ecosistema-demo' && !isDemoEnabled()) notFound();
  if (
    !/^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|ecosistema-demo)$/.test(
      token,
    )
  )
    notFound();
  return <GuestPlayer token={token} />;
}
