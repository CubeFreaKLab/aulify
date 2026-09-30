'use client';

import { useEffect, useRef, useState } from 'react';
import type { DemoState, User } from '@/domain';
import { HELP_STEPS, HELP_VERSION, helpState } from '@/domain/help';
import { runDemo } from '@/demo/store';
import { Button, DialogPanel } from './ui';

export function HelpSteps({ teacher }: { teacher: boolean }) {
  return (
    <div>
      {HELP_STEPS[teacher ? 'teacher' : 'student'].map(([title, text], index) => (
        <div className="help-step" key={title}>
          <span className="step-number" aria-hidden="true">
            {index + 1}
          </span>
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StaticAttemptHelp() {
  return (
    <details className="surface" style={{ padding: 16, marginBottom: 20 }}>
      <summary>Ayuda durante la actividad</summary>
      <p style={{ marginTop: 12 }}>
        Selecciona o escribe tu respuesta y confirma con Responder. Lo confirmado es definitivo; si
        falla el envío, conserva la página y vuelve a intentarlo.
      </p>
      <p>
        En una sesión guiada, espera al docente. La ayuda no pausa el tiempo ni modifica tus
        oportunidades o respuestas.
      </p>
    </details>
  );
}

export function HelpGuide({
  state,
  user,
  placement,
}: {
  state: DemoState;
  user: User;
  placement: 'dashboard' | 'help';
}) {
  const { current, firstVisit, newVersion, invitation, activeAttempt } = helpState(state, user);
  const [open, setOpen] = useState(placement === 'dashboard' && firstVisit && !activeAttempt);
  const [step, setStep] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const recorded = useRef(false);
  const offerWrite = useRef<Promise<unknown>>(Promise.resolve());
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const steps = HELP_STEPS[user.role];

  useEffect(() => {
    if (placement === 'dashboard' && !current && !activeAttempt && !recorded.current) {
      recorded.current = true;
      offerWrite.current = runDemo(async (repository) => {
        await repository.setHelpPreference(user.id, 'offered', HELP_VERSION);
      });
    }
  }, [placement, current, activeAttempt, user.id]);
  useEffect(() => {
    if (step !== null) heading.current?.focus();
  }, [step]);

  async function finish(completed: boolean) {
    if (saving) return;
    setSaving(true);
    await offerWrite.current;
    const saved = await runDemo(async (repository) => {
      await repository.setHelpPreference(
        user.id,
        completed || current?.status === 'completed' ? 'completed' : 'skipped',
        HELP_VERSION,
      );
      return true;
    });
    setSaving(false);
    if (saved) {
      setOpen(false);
      setStep(null);
      requestAnimationFrame(() => {
        if (trigger.current?.isConnected) trigger.current.focus();
        else {
          const title = document.querySelector<HTMLHeadingElement>('main h1');
          if (title) {
            title.tabIndex = -1;
            title.focus();
          }
        }
      });
    }
  }

  if (activeAttempt) return placement === 'help' ? <StaticAttemptHelp /> : null;
  if (placement === 'dashboard' && !invitation && !open) return null;
  return (
    <>
      <section
        aria-label="Guía de Aulify"
        className={placement === 'dashboard' ? 'notice' : undefined}
        style={{ marginBottom: 20 }}
      >
        {placement === 'dashboard' && (
          <p>
            {newVersion
              ? 'Hay una nueva versión de la guía de Aulify.'
              : 'Conoce tu espacio en cinco pasos.'}
          </p>
        )}
        <div className="row" style={{ flexWrap: 'wrap', marginTop: 12 }}>
          <Button
            ref={trigger}
            variant="secondary"
            onPress={() => {
              setStep(0);
              setOpen(true);
            }}
          >
            {placement === 'help' ? 'Repetir la guía' : 'Conocer Aulify'}
          </Button>
          {placement === 'dashboard' && (
            <Button variant="ghost" isDisabled={saving} onPress={() => void finish(false)}>
              Ahora no
            </Button>
          )}
        </div>
      </section>
      <DialogPanel
        open={open}
        onClose={() => void finish(false)}
        title={
          user.role === 'teacher'
            ? 'Tu primera clase, paso a paso'
            : 'Este es tu espacio para aprender'
        }
      >
        {step === null ? (
          <>
            <p>
              Conoce las herramientas de tu perfil en cinco pasos. Puedes cerrar o repetir esta guía
              desde Ayuda cuando quieras.
            </p>
            <div className="dialog-actions">
              <Button variant="ghost" isDisabled={saving} onPress={() => void finish(false)}>
                Ahora no
              </Button>
              <Button onPress={() => setStep(0)}>Conocer Aulify</Button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Paso {step + 1} de {steps.length}
            </p>
            <div className="help-step">
              <span className="step-number" aria-hidden="true">
                {step + 1}
              </span>
              <div>
                <h3 ref={heading} tabIndex={-1}>
                  {steps[step][0]}
                </h3>
                <p>{steps[step][1]}</p>
              </div>
            </div>
            <div className="dialog-actions">
              {step > 0 && (
                <Button variant="secondary" onPress={() => setStep(step - 1)}>
                  Anterior
                </Button>
              )}
              {step < steps.length - 1 ? (
                <Button onPress={() => setStep(step + 1)}>Siguiente</Button>
              ) : (
                <Button isDisabled={saving} onPress={() => void finish(true)}>
                  Terminar guía
                </Button>
              )}
            </div>
          </>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
          La guía solo explica los pasos; no crea materias, publica actividades ni registra
          respuestas.
        </p>
      </DialogPanel>
    </>
  );
}
