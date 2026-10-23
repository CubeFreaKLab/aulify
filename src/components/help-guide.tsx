'use client';

import type { DemoState, User } from '@/domain';
import { HELP_STEPS, helpState } from '@/domain/help';

import { OpenPageGuide } from './page-guide';

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
  if (helpState(state, user).activeAttempt)
    return placement === 'help' ? <StaticAttemptHelp /> : null;
  if (placement === 'dashboard') return null;
  return <OpenPageGuide>Repetir la guía</OpenPageGuide>;
}
