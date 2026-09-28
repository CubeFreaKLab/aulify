const messages: Record<string, string> = {
  FORBIDDEN: 'No tienes permiso para realizar esta acción.',
  AUTH_REQUIRED: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  CONFIRM_PENDING: 'Confirma tu correo antes de continuar.',
  PROFILE_REQUIRED: 'No pudimos cargar tu perfil. Vuelve a iniciar sesión.',
  TEACHER_REQUIRED: 'Esta acción corresponde al docente.',
  STUDENT_REQUIRED: 'Esta acción corresponde al estudiante.',
  MEMBERSHIP_REQUIRED: 'Necesitas una inscripción aprobada en esta materia.',
  ALREADY_MEMBER: 'Ya estás inscrito en esta materia.',
  REVISION_CONFLICT:
    'Otra pestaña modificó este borrador. Conserva una copia o recarga la versión guardada.',
  MANUAL_GUIDE_REQUIRED: 'Añade una guía de corrección a las preguntas escritas.',
  INVALID_IMAGE: 'Revisa la imagen: necesita un archivo válido y texto alternativo.',
  INVALID_SETTINGS: 'Revisa la configuración de la actividad: alguna combinación no es válida.',
  ACTIVITY_LOCKED: 'La actividad ya tiene intentos. Publica otra versión para cambiar sus reglas.',
  ACTIVITY_CLOSED: 'Esta actividad está cerrada.',
  ACTIVITY_UNAVAILABLE: 'Esta actividad no está disponible para tu cuenta.',
  ATTEMPTS_EXHAUSTED: 'Ya utilizaste los intentos disponibles.',
  ATTEMPT_CLOSED: 'Este intento ya terminó.',
  ATTEMPT_EXPIRED: 'Se terminó el plazo del intento.',
  ATTEMPT_OPEN: 'Todavía hay un intento abierto.',
  ANSWER_FINAL: 'Esta respuesta ya fue enviada y no puede cambiarse.',
  IDEMPOTENCY_CONFLICT:
    'La solicitud ya se recibió con otro contenido. Actualiza la página para consultar su estado.',
  QUESTION_ORDER: 'Responde la pregunta actual antes de continuar.',
  QUESTION_CLOSED: 'Esta pregunta ya cerró.',
  WAIT_FOR_TEACHER: 'Espera a que el docente abra la siguiente pregunta.',
  GUIDED_STATE: 'El estado de la sesión cambió. Actualiza la página antes de continuar.',
  ROOM_CLOSED: 'La sala ya está cerrada.',
  ROOM_EMPTY: 'Espera a que un estudiante entre en la sala.',
  CONFIRM_REASON_REQUIRED: 'Escribe el motivo de este cambio.',
  REVISION_REASON_REQUIRED: 'Escribe el motivo de la nueva evaluación.',
  REVIEW_PENDING: 'Quedan respuestas pendientes de corrección.',
  STALE_EVALUATION: 'La evaluación cambió. Revisa la versión actual antes de publicarla.',
  GRADE_RANGE: 'La calificación debe estar entre cero y el máximo permitido.',
  HINT_USED: 'Ya utilizaste la pista de esta actividad.',
  HINT_UNAVAILABLE: 'Esta pregunta no tiene una pista disponible.',
  POWERUP_USED: 'Ya utilizaste este potenciador.',
  POWERUP_DISABLED: 'El docente no habilitó este potenciador.',
  TASK_CLOSED: 'La tarea está fuera de su plazo de entrega.',
  TASK_UNAVAILABLE: 'Esta tarea no está disponible.',
  RESUBMISSION_PERMISSION_REQUIRED: 'El docente debe habilitar una nueva entrega.',
  RESTORE_UNAVAILABLE: 'La materia ya no puede restaurarse.',
  TEAMS_LOCKED: 'Los equipos no pueden cambiarse después de comenzar.',
  TEAMS_REQUIRED: 'Configura los equipos antes de iniciar la actividad.',
  CODE_INVALID: 'El código no está activo o no existe.',
  RATE_LIMIT: 'Has realizado varias solicitudes. Espera unos minutos e inténtalo de nuevo.',
  ADMINISTRATIVE_CLOSE_REQUIRED:
    'Revisa y resuelve el cierre administrativo de este intento antes de publicar su nota.',
};

export function commandError(code: string) {
  return (
    messages[code] ||
    (code.startsWith('INVALID_')
      ? 'Revisa los datos: falta información o hay un valor no válido.'
      : 'No pudimos completar el cambio. Actualiza la página y revisa los datos.')
  );
}
