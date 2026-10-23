'use client';
/* eslint-disable @next/next/no-img-element */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Check } from 'lucide-react';
import { AVATARS, defaultAvatar, isAvatarId, type AvatarId } from '@/domain/avatars';
import '@/styles/avatars.css';

const eventName = 'aulify:avatar';
const memory = new Map<string, AvatarId>();
const keyFor = (id: string) => `aulify:avatar:${id}`;
function readAvatar(userId: string): AvatarId {
  try {
    const saved = localStorage.getItem(keyFor(userId));
    if (isAvatarId(saved)) return saved;
  } catch {
    /* Session memory also works when browser storage is unavailable. */
  }
  return memory.get(userId) ?? defaultAvatar(userId);
}
function saveAvatar(userId: string, avatarId: AvatarId) {
  memory.set(userId, avatarId);
  try {
    localStorage.setItem(keyFor(userId), avatarId);
  } catch {
    /* Keep the session usable. */
  }
  window.dispatchEvent(new Event(eventName));
}
function subscribe(notify: () => void) {
  window.addEventListener(eventName, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(eventName, notify);
    window.removeEventListener('storage', notify);
  };
}
function useAvatar(userId: string) {
  return useSyncExternalStore(
    subscribe,
    () => readAvatar(userId),
    () => defaultAvatar(userId),
  );
}
const AvatarContext = createContext<{ live: boolean; ready: boolean; error: string }>({
  live: false,
  ready: true,
  error: '',
});

export function AvatarProvider({
  userId,
  live,
  children,
}: {
  userId: string;
  live: boolean;
  children: ReactNode;
}) {
  const [loadedFor, setLoadedFor] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!live) return;
    let active = true;
    void fetch('/api/profile/avatars', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json();
        if (active && body.avatars && typeof body.avatars === 'object')
          for (const [id, avatar] of Object.entries(body.avatars))
            if (id !== userId && isAvatarId(avatar)) saveAvatar(id, avatar);
      })
      .catch(() => {
        /* Keep deterministic placeholders if the connection is unavailable. */
      });
    void fetch('/api/profile/avatar', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data.userId !== userId)
          throw new Error(data.error || 'No pudimos cargar tu avatar.');
        if (active) {
          saveAvatar(userId, isAvatarId(data.avatarId) ? data.avatarId : defaultAvatar(userId));
          setError('');
        }
      })
      .catch(() => {
        if (active)
          setError(
            'No pudimos recuperar tu elección. Puedes seleccionar un avatar para guardarlo de nuevo.',
          );
      })
      .finally(() => {
        if (active) setLoadedFor(userId);
      });
    return () => {
      active = false;
    };
  }, [userId, live]);
  return (
    <AvatarContext.Provider value={{ live, ready: !live || loadedFor === userId, error }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function ProfileAvatar({ userId, size = 40 }: { userId: string; size?: number }) {
  const avatarId = useAvatar(userId);
  return (
    <img
      className="profile-avatar"
      src={`/illustrations/avatars/${avatarId}.svg`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

export function AvatarPicker({ userId }: { userId: string }) {
  const selected = useAvatar(userId);
  const { live, ready, error: loadError } = useContext(AvatarContext);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function choose(avatarId: AvatarId) {
    if (busy || !ready) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      if (live) {
        const response = await fetch('/api/profile/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId }),
          signal: AbortSignal.timeout(10000),
        });
        const data = await response.json();
        if (!response.ok || data.userId !== userId || data.avatarId !== avatarId)
          throw new Error(data.error || 'No se guardó el avatar. Intenta de nuevo.');
      }
      saveAvatar(userId, avatarId);
      setMessage(
        live
          ? 'Avatar guardado en tu cuenta.'
          : 'Avatar guardado para este perfil de demostración.',
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'No se guardó el avatar. Intenta de nuevo.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="avatar-picker" aria-labelledby="avatar-title" aria-busy={busy}>
      <div className="avatar-picker-heading">
        <ProfileAvatar userId={userId} size={76} />
        <div>
          <h3 id="avatar-title">Elige tu avatar</h3>
          <p className="muted">30 personajes. Elige el que más te guste.</p>
        </div>
      </div>
      <div className="avatar-grid" role="group" aria-label="Avatares disponibles">
        {AVATARS.map((avatar, index) => (
          <button
            type="button"
            key={avatar.id}
            className="avatar-option"
            aria-label={`Avatar ${index + 1}: ${avatar.label}`}
            title={avatar.label}
            aria-pressed={selected === avatar.id}
            disabled={busy || !ready}
            onClick={() => void choose(avatar.id)}
          >
            <img
              src={`/illustrations/avatars/${avatar.id}.svg`}
              alt=""
              width="76"
              height="76"
              loading="lazy"
            />
            {selected === avatar.id && (
              <span className="avatar-check">
                <Check size={14} aria-hidden="true" />
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="avatar-status muted" role="status">
        {busy
          ? 'Guardando avatar…'
          : !ready
            ? 'Cargando tu elección…'
            : message ||
              (live
                ? 'Tu elección se conserva al volver a entrar.'
                : 'La elección se guarda por perfil en este navegador.')}
      </p>
      {(error || (loadError && !message)) && (
        <p className="notice error" role="alert">
          {error || loadError}
        </p>
      )}
    </section>
  );
}
