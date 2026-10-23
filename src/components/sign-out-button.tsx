'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from './ui';
import { clearWorkspaceSession } from '@/demo/store';
import '@/styles/sign-out.css';

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="sign-out-control">
      <Button
        variant="ghost small"
        isDisabled={pending}
        onPress={async () => {
          setPending(true);
          setError('');
          try {
            const result = await fetch('/api/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'signout' }),
            });
            if (!result.ok) throw new Error('signout');
            clearWorkspaceSession();
            // A full navigation also discards private React state and the client router cache.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign('/');
          } catch {
            setError('No pudimos cerrar la sesión. Intenta otra vez.');
            setPending(false);
          }
        }}
      >
        <LogOut size={17} aria-hidden="true" />
        {pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
