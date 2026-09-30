'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Eye, EyeOff, GraduationCap } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field } from './ui';
import { clearWorkspaceSession } from '@/demo/store';
import '../styles/auth.css';

type AuthMode = 'access' | 'register' | 'recover' | 'update-password';
type Errors = Partial<Record<'name' | 'email' | 'password' | 'profile', string>>;

const content: Record<AuthMode, { title: string; description: string; action: string }> = {
  access: {
    title: 'Qué bueno verte.',
    description: 'Una nueva clase empieza con una buena idea.',
    action: 'Continuar',
  },
  register: {
    title: 'Tu lugar en el aula.',
    description: 'Elige cómo vas a participar en Aulify.',
    action: 'Crear cuenta',
  },
  recover: {
    title: 'Recupera tu acceso.',
    description: 'Te enviaremos un enlace para volver a tu aula.',
    action: 'Enviar enlace de recuperación',
  },
  'update-password': {
    title: 'Elige tu nueva contraseña.',
    description: 'Usa una contraseña que solo tú conozcas.',
    action: 'Guardar contraseña',
  },
};

export function AuthScreen({
  mode,
  initialStatus = '',
}: {
  mode: AuthMode;
  initialStatus?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [selectedProfile, setSelectedProfile] = useState<'docente' | 'estudiante' | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const copy = content[mode];
  const registering = mode === 'register';
  const recovering = mode === 'recover';
  const updating = mode === 'update-password';

  function describe(field: keyof Errors, hasHint = false) {
    return (
      [hasHint ? `auth-${field}-hint` : '', errors[field] ? `auth-${field}-error` : '']
        .filter(Boolean)
        .join(' ') || undefined
    );
  }

  function clearError(field: keyof Errors) {
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setStatus('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const nextErrors: Errors = {};
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (registering && String(data.get('name') ?? '').trim().length < 2) {
      nextErrors.name = 'Escribe tu nombre, con al menos dos caracteres.';
    }
    if (!updating && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      nextErrors.email = 'Escribe un correo completo, como nombre@ejemplo.com.';
    }
    if (!recovering && !password) {
      nextErrors.password = 'Escribe tu contraseña.';
    } else if ((registering || updating) && password.length < 8) {
      nextErrors.password = 'Usa al menos ocho caracteres.';
    }
    if (registering && !data.get('profile')) nextErrors.profile = 'Elige docente o estudiante.';
    setErrors(nextErrors);
    setStatus('');
    if (Object.keys(nextErrors).length) {
      const first = Object.keys(nextErrors)[0];
      form.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setPending(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          email,
          password,
          name: data.get('name'),
          role:
            selectedProfile === 'docente'
              ? 'teacher'
              : selectedProfile === 'estudiante'
                ? 'student'
                : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No pudimos completar la solicitud.');
      const passwordInput = form.elements.namedItem('password');
      if (passwordInput instanceof HTMLInputElement) passwordInput.value = '';
      setShowPassword(false);
      if (result.redirect) {
        clearWorkspaceSession();
        router.replace(result.redirect);
        router.refresh();
      } else setStatus(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No hay conexión. Inténtalo de nuevo.');
    } finally {
      setPending(false);
      requestAnimationFrame(() => statusRef.current?.focus());
    }
  }

  return (
    <div className={`auth-page auth-page-${mode}`}>
      <header className="auth-header">
        <Link href="/" aria-label="Aulify, volver al inicio" className="auth-logo">
          <Image src="/brand/aulify-logo.svg" alt="Aulify" width={866} height={288} priority />
        </Link>
        <Link className="auth-home-link" href="/">
          <ArrowLeft size={16} aria-hidden="true" /> Volver al inicio
        </Link>
      </header>

      <main id="contenido" className="auth-layout">
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-form-container">
            <div className="auth-heading">
              <h1 id="auth-title">{copy.title}</h1>
              <p>{copy.description}</p>
            </div>

            <form className="auth-form" noValidate onSubmit={submit} aria-busy={pending}>
              {registering && (
                <Field label="Tu nombre" id="auth-name" error={errors.name}>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Cómo te llamas"
                    required
                    maxLength={100}
                    aria-invalid={!!errors.name}
                    aria-describedby={describe('name')}
                    onChange={() => clearError('name')}
                  />
                </Field>
              )}
              {!updating && (
                <Field label="Correo electrónico" id="auth-email" error={errors.email}>
                  <input
                    id="auth-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="nombre@ejemplo.com"
                    required
                    maxLength={254}
                    aria-invalid={!!errors.email}
                    aria-describedby={describe('email')}
                    onChange={() => clearError('email')}
                  />
                </Field>
              )}

              {!recovering && (
                <Field
                  label="Contraseña"
                  id="auth-password"
                  hint={
                    registering || updating
                      ? 'Al menos ocho caracteres. Puedes pegar tu contraseña.'
                      : undefined
                  }
                  error={errors.password}
                >
                  <div className="auth-password">
                    <input
                      id="auth-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={registering || updating ? 'new-password' : 'current-password'}
                      placeholder={
                        registering || updating ? 'Crea una contraseña' : 'Tu contraseña'
                      }
                      required
                      minLength={registering || updating ? 8 : undefined}
                      maxLength={128}
                      aria-invalid={!!errors.password}
                      aria-describedby={describe('password', registering || updating)}
                      onChange={() => clearError('password')}
                    />
                    <button
                      type="button"
                      className="icon-button auth-password-toggle"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? (
                        <EyeOff size={20} aria-hidden="true" />
                      ) : (
                        <Eye size={20} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </Field>
              )}

              {mode === 'access' && (
                <Link href="/recuperar" className="auth-recover-link">
                  ¿Olvidaste tu contraseña?
                </Link>
              )}

              {registering && (
                <fieldset
                  className="auth-profiles"
                  aria-describedby={describe('profile')}
                  aria-invalid={!!errors.profile}
                >
                  <legend>Quiero participar como</legend>
                  <div className="auth-profile-options">
                    <label
                      className={`auth-profile ${selectedProfile === 'docente' ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="profile"
                        value="docente"
                        checked={selectedProfile === 'docente'}
                        onChange={() => {
                          setSelectedProfile('docente');
                          clearError('profile');
                        }}
                        required
                      />
                      <BookOpen size={20} aria-hidden="true" />
                      <span>Docente</span>
                    </label>
                    <label
                      className={`auth-profile ${selectedProfile === 'estudiante' ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="profile"
                        value="estudiante"
                        checked={selectedProfile === 'estudiante'}
                        onChange={() => {
                          setSelectedProfile('estudiante');
                          clearError('profile');
                        }}
                        required
                      />
                      <GraduationCap size={22} aria-hidden="true" />
                      <span>Estudiante</span>
                    </label>
                  </div>
                  {errors.profile && (
                    <span className="field-error" id="auth-profile-error">
                      {errors.profile}
                    </span>
                  )}
                </fieldset>
              )}

              <Button type="submit" className="auth-submit" isDisabled={pending}>
                {pending ? 'Un momento…' : copy.action}
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
              {status && (
                <div role="status" tabIndex={-1} ref={statusRef} className="auth-status">
                  <p>{status}</p>
                  {registering && selectedProfile && (
                    <Link href={`/demo?perfil=${selectedProfile}`} className="auth-status-link">
                      Explorar como {selectedProfile}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              )}
            </form>

            <p className="auth-switch">
              {registering ? (
                <>
                  ¿Ya tienes una cuenta? <Link href="/acceso">Inicia sesión</Link>
                </>
              ) : recovering ? (
                <Link href="/acceso">
                  <ArrowLeft size={15} aria-hidden="true" /> Volver a iniciar sesión
                </Link>
              ) : (
                <>
                  ¿Es tu primera vez? <Link href="/registro">Conoce el registro</Link>
                </>
              )}
            </p>

            <div className="auth-explore">
              <div className="auth-explore-heading">
                <span />
                Explora sin una cuenta
                <span />
              </div>
              <div className="auth-demo-actions">
                <Link href="/demo?perfil=docente" className="button secondary">
                  <BookOpen size={17} aria-hidden="true" />
                  Explorar como docente
                </Link>
                <Link href="/demo?perfil=estudiante" className="button secondary">
                  <GraduationCap size={19} aria-hidden="true" />
                  Explorar como estudiante
                </Link>
              </div>
              <p>Prueba una clase con datos ficticios.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
