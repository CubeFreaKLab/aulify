import type { ReactNode } from 'react';
import { Workspace } from '@/components/workspace';

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Workspace />
      {children}
    </>
  );
}
