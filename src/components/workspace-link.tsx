'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';
export function workspacePath(path: string, currentPath: string) {
  return currentPath.startsWith('/aula') && (path === '/demo' || path.startsWith('/demo/'))
    ? path.replace(/^\/demo/, '/aula')
    : path;
}
export default function WorkspaceLink(props: ComponentProps<typeof Link>) {
  const path = usePathname();
  return (
    <Link
      {...props}
      href={typeof props.href === 'string' ? workspacePath(props.href, path) : props.href}
    />
  );
}
export function useWorkspaceRouter() {
  const router = useRouter();
  const path = usePathname();
  return {
    ...router,
    push: (href: string) => router.push(workspacePath(href, path)),
    replace: (href: string) => router.replace(workspacePath(href, path)),
  };
}
