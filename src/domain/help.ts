import type { DemoState, User } from './types';

export const HELP_VERSION = 2;

export function helpState(state: DemoState, user: User) {
  // El rol principal es inmutable en 1.0; la cuenta identifica también su recorrido.
  const preferences = state.helpPreferences.filter((item) => item.userId === user.id);
  const current = preferences.find((item) => item.version === HELP_VERSION);
  return {
    current,
    firstVisit: preferences.length === 0,
    newVersion:
      preferences.some((item) => item.version < HELP_VERSION) &&
      (!current || current.status === 'offered'),
    invitation: !current || current.status === 'offered',
    activeAttempt: state.attempts.some(
      (attempt) => attempt.studentId === user.id && attempt.status === 'in-progress',
    ),
  };
}

export const HELP_STEPS = {
  teacher: [
    [
      'Crea tu materia',
      'En Materias, crea tu clase e indica curso y año. Cada materia conserva sus propios integrantes y resultados.',
    ],
    [
      'Invita y aprueba',
      'Comparte el código de la materia y aprueba las solicitudes. Tener el código no concede acceso por sí solo.',
    ],
    [
      'Prepara un recurso',
      'En Biblioteca, combina explicaciones y preguntas. El borrador se guarda sin publicarse para los estudiantes.',
    ],
    [
      'Previsualiza y publica',
      'Comprueba el contenido en Vista previa; no consume intentos. Publica y revisa las reglas de la actividad antes de compartirla.',
    ],
    [
      'Revisa y publica las notas',
      'Corrige las respuestas escritas y publica cada resultado. El peso determina su aporte al promedio; una nota pendiente no equivale a cero.',
    ],
  ],
  student: [
    [
      'Ingresa el código',
      'En Materias, escribe el código que comparta tu docente para solicitar acceso.',
    ],
    [
      'Espera la aprobación',
      'Tu solicitud queda pendiente hasta que el docente la apruebe. Luego podrás consultar los materiales de esa materia.',
    ],
    [
      'Abre una actividad',
      'Lee las instrucciones, el plazo y las oportunidades disponibles. Abrir las instrucciones no consume un intento; empezarlo sí.',
    ],
    [
      'Piensa y responde',
      'Selecciona o escribe y confirma con Responder. Una respuesta confirmada es definitiva. En una sesión guiada, espera el avance docente.',
    ],
    [
      'Consulta tus resultados',
      'En Resultados aparecen tus notas publicadas. El peso indica cuánto aporta cada una al promedio; una pendiente todavía no tiene nota.',
    ],
  ],
} satisfies Record<User['role'], [string, string][]>;
