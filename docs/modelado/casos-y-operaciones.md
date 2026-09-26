# Casos de uso y operaciones del dominio

Los actores de negocio son docente y estudiante. Auth, Storage y el proceso de limpieza son colaboradores técnicos, no nuevos roles institucionales. Este catálogo resume el comportamiento existente del spec; no amplía el alcance.

| Caso | Actor | Resultado observable | Requisitos | Relaciones principales |
|---|---|---|---|---|
| UC-01 · Acceder y recuperar cuenta | Ambos | Cuenta confirmada, acceso propio y recuperación sin revelar existencia de correos. | RF-01 | Auth, profiles. |
| UC-02 · Organizar materia e integrantes | Docente | Materia con curso/año y solicitudes decididas; pertenencia estable. | RF-02 | subjects, invitation_codes, join_requests, memberships, membership_events. |
| UC-03 · Solicitar ingreso | Estudiante | Solicitud pendiente, aprobación necesaria antes de acceder. | RF-02 | join_requests, memberships. |
| UC-04 · Preparar y publicar recurso | Docente | Borrador recuperable y publicación inmutable con preguntas válidas. | RF-03, RF-04, RF-13 | resources, resource_drafts, resource_versions, bloques, preguntas y soluciones. |
| UC-05 · Configurar y dirigir actividad | Docente | Reglas comprensibles; avance individual o sesión guiada persistente. | RF-05, RF-14, RF-16 | activities, subtipos, guided_sessions, session_questions, deadline_extensions. |
| UC-06 · Participar en quiz | Estudiante | Respuestas definitivas, reconexión e intentos respetados; juego opcional. | RF-05, RF-06, RF-13, RF-15 | participants, attempts, attempt_questions, responses, powerup_uses. |
| UC-07 · Entregar tarea | Estudiante | Versión completa de archivos propios recibida dentro de reglas de plazo. | RF-10 | submissions, submission_versions, submission_files, resubmission_windows. |
| UC-08 · Corregir y publicar notas | Docente | Evaluación completa y publicada individualmente; historial conservado. | RF-07, RF-08, RF-11 | question_grades, evaluation_revisions, evaluation_question_grades. |
| UC-09 · Consultar seguimiento | Docente/estudiante | Docente observa su materia; estudiante consulta resultados propios publicados. | RF-08, RF-12 | Proyecciones de evaluaciones, pertenencias y entregas. |
| UC-10 · Revisar incidencias | Docente | Observación contextual sin sanción automática. | RF-09 | integrity_events, incident_reviews, attempt_resolutions. |
| UC-11 · Archivar o restaurar materia | Docente | Conservación temporal y recuperación dentro de 30 días; purga posterior. | RF-02 | subjects, subject_events, purge_jobs y dependencias. |
| UC-12 · Consultar ayuda | Ambos | Guía opcional, accesible y reabrible sin alterar actividad. | RF-17 | help_progress; rol del perfil y catálogo de guías. |

## Operaciones que deben ser coherentes

### Aprobar solicitud

Verificar docente propietario y solicitud pendiente. Coordinar la materia para que otra aprobación, renovación o retiro no altere las condiciones durante la operación. Crear o reactivar la membresía de la misma pareja materia/estudiante, registrar el evento y resolver la solicitud. Una repetición obtiene el estado actual sin otra membresía. La referencia estable conserva intentos, resultados y consumos de un reingreso.

### Publicar recurso y asignar actividad

Leer la revisión esperada del borrador, validar límites, tipos, imágenes, preguntas y soluciones. Crear en una transacción versión, grupos, bloques, preguntas, elementos y secretos. Un fallo no deja una versión publicada a medias. Preparar la actividad con referencia a esa versión y el subtipo correcto; publicar la actividad es un acto explícito distinto de publicar una versión en biblioteca.

En lectura no se generan intentos ni notas. En quiz se congela la configuración al primer intento. Una nueva edición de recurso crea otra versión y, si la actividad ya empezó, exige otra actividad.

### Iniciar intento individual

Verificar pertenencia, disponibilidad y configuración bajo coordinación de actividad y participante. Si ya existe un intento abierto, devolver ese mismo. Si la clave identifica un inicio confirmado, no consumir otra oportunidad. Comprobar límite, asignar número, fijar preguntas y orden de elementos, registrar inicio y bloquear reglas de la actividad si aún no lo estaba. El reloj y la versión los determina el servidor.

El plazo efectivo se calcula con cierre general vigente y duración, más ampliación individual autorizada. No guardarlo como un segundo valor mutable sin una regla de actualización.

### Confirmar respuesta

1. Autenticar, comprobar pertenencia y obtener la pregunta asignada del intento propio.
2. Buscar la clave de petición. Si corresponde al mismo envío confirmado, devolver su resultado autorizado; si cambia el contenido o pertenece a otra operación, rechazar.
3. Para envío nuevo, verificar que no hay respuesta final, que el intento está abierto, que la pregunta está disponible y que no venció el plazo de servidor.
4. Validar payload y opciones contra la versión. Registrar respuesta y, si corresponde, consumir doble en la misma transacción.
5. Crear corrección automática para pregunta cerrada, o dejar sin corrección la escrita/manual. No inventar puntos cero para una revisión pendiente.
6. Cerrar intento individual si fue la última pregunta; confirmar transacción. Devolver únicamente la información permitida por retroalimentación y avanzar sin pantalla intermedia de guardado.

Perder la respuesta de red después del paso 6 no pierde lo persistido. El reintento recupera el mismo resultado autorizado. El [flujo editable](diagramas/09-respuesta.dot) y su [figura](diagramas/09-respuesta.svg) representan estas bifurcaciones, no una ejecución real.

### Corregir y publicar evaluación

Añadir una revisión de puntuación por pregunta con motivo cuando corrige una anterior. Para quiz, seleccionar el mejor intento cerrado, resuelto y completamente corregido según nota; construir un candidato con las revisiones exactas utilizadas. Para tarea, referenciar la versión de entrega; para actividad manual, registrar directamente la nota.

La publicación se serializa por participante, verifica que el candidato sigue vigente y marca su fecha de publicación una sola vez. La consulta obtiene la revisión publicada de mayor número. Un borrador posterior no cambia lo visible; una revisión vieja no se puede publicar por encima de otra nueva. El promedio utiliza la última publicada de cada actividad incluida, normalizada por máximo y peso.

### Sesión guiada, equipos y cierre

Inscribirse a sala registra participante, sin intento. Al iniciar, verificar miembros aprobados, equipos no vacíos y reglas; fijar composición, crear intentos de inscritos y registrar comienzo. Abrir/cerrar pregunta modifica una ventana común persistente. Cerrar con estudiantes sin responder requiere confirmación y genera correcciones por omisión, sin crear respuestas ficticias.

Cerrar la última pregunta termina normalmente. Cierre anticipado, retiro o archivo conservan lo confirmado y requieren resolución antes de considerar definitivo el resultado. Una desconexión docente no es una orden de avance ni cierre; reconectar consulta el estado persistido.

### Recibir entrega

Subir archivos a ubicaciones privadas preparadas; validar los objetos y, al confirmar, comprobar propiedad, tipo, tamaño, cantidad, plazo y autorización de reentrega. Solo entonces crear una versión completa con todas sus referencias. Registrar la ventana individual utilizada y el plazo aplicado. Limpiar después objetos huérfanos; nunca eliminar la última entrega válida porque una carga nueva falló.

## Guía breve para explicar el modelo

El recorrido puede explicarse con cinco hechos: el docente conserva un recurso; publica una versión; la asigna como actividad; el estudiante genera intentos o entregas; el docente publica una evaluación. Los diagramas añaden pertenencia, permisos e historial para que esos hechos no se mezclen.

Una pregunta típica es por qué no guardar la nota en la respuesta. La respuesta registra lo que envió el estudiante; la corrección puede revisarse y la nota se publica en otro momento. Separarlas permite demostrar qué ocurrió, cómo se calculó y qué se hizo visible.

Otra es por qué mantener JSONB si se usa un modelo relacional. El formato de un bloque o el contenido de un envío son agregados variables. Identidades, pertenencias, elementos de pregunta, versiones y calificaciones sí tienen claves y relaciones explícitas. Las excepciones y su validación están documentadas en [normalización](normalizacion.md).
