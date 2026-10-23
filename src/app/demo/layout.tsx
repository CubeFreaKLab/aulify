import type { ReactNode } from 'react';
import { Workspace } from '@/components/workspace';
import { notFound } from 'next/navigation';
import { isDemoEnabled } from '@/lib/demo-availability';

export default function DemoLayout({ children }: { children: ReactNode }) {
  if (!isDemoEnabled()) notFound();
  return (
    <>
      <Workspace />
      {children}
    </>
  );
}
