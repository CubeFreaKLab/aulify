# Contrato de datos 1.0

La implementación utiliza las 44 relaciones del dominio y una relación técnica de control de frecuencia en el esquema privado `app`. Las tablas no se exponen a Data API. La identidad se obtiene siempre con `auth.uid()`; los argumentos `actorId` o `studentId` de conveniencia del prototipo no conceden permisos.

## Entrada

- `public.aulify_snapshot()` devuelve `{state, userId, studentActivities, studentResults}`. `state` conserva la estructura de `DemoState`; contiene únicamente información autorizada. Las proyecciones de estudiantes se consultan en los mapas por actividad/materia, sin ejecutar reglas de calificación locales.
- `public.aulify_command(p_action text, p_payload jsonb)` recibe `{args: [...]}` con los argumentos del método equivalente de `DemoRepository`, sin identidad. Devuelve el resultado de la operación. Después de una mutación, obtener snapshot actualizado.
- `readActivity` y `readAttempt` reciben `args: [id]` y devuelven las proyecciones autorizadas.

Los métodos existentes conservan orden: `saveDraft(resource,expectedRevision)`, `publishResource(resourceId)`, `createActivity(versionId,subjectId,settings,title?)`, `updateActivity(activityId,settings)`, `createSubject(details)`, `requestMembership(code)`, `decideMembership(requestId,decision)`, `joinGuidedRoom(activityId)`, `startGuidedSession(activityId)`, `closeGuidedQuestion(activityId,confirmPending)`, `openNextGuidedQuestion(activityId)`, `startAttempt(activityId)`, `submitAnswer(attemptId,questionId,value,idempotencyKey,useDouble)`, `useHint(attemptId,questionId)`, `reviewAnswer(attemptId,questionId,points,comment,reason)`, `publishGrade(activityId,studentId,comment,reason)`, `createTask(details)`, `submitTask(taskId,files,note,requestKey?)`, `reviewTask(submissionVersionId,grade,comment,reason?)`, `publishTaskGrade(submissionVersionId)`, `setHelpPreference(status,version)`.

Ampliaciones: `updateSubject(subjectId,details)`, `renewCode(subjectId,enabled)`, `withdrawMembership(membershipId,reason)`, `archiveSubject(subjectId)`, `restoreSubject(subjectId)`, `resolveAttempt(attemptId,decision,reason)`, `extendDeadline(activityId,deadline,reason,participantId?)`, `endGuidedSession(activityId,reason,confirmPending)`, `configureTeams(activityId,teams)` con `teams:[{name,studentIds}]`, `createManualActivity(details)`, `gradeManual(activityId,studentId,grade,comment,reason,publish)`, `allowResubmission(taskId,studentId,deadline,reason)`, `reportVisibility(attemptId,eventKey,hiddenAt,visibleAt?)`, `reviewIncident(attemptId,status,comment)`, `ranking(activityId)`.

Todos los identificadores persistentes son UUID. `Question` y `AnswerValue` usan la forma TypeScript existente. `requestMembership` devuelve ID de solicitud; `decideMembership` consume ese mismo ID (no el ID de membresía persistente). Las filas de membresías proyectadas pendientes/rechazadas son solicitudes, mientras las aprobadas/retiradas usan el ID estable de membresía.

### Resultados exactos

`saveDraft` devuelve `Resource`; `publishResource`, `ResourceVersion`; `createActivity` y sus controles, `Activity`; `startAttempt`, `Attempt`. `reviewAnswer` devuelve el intento con correcciones para el docente. `createSubject` devuelve `{id}`: recuperar el objeto completo del snapshot. `createTask`, `Task`; las acciones de entrega devuelven `TaskSubmission`. `useHint` devuelve el texto de la pista.

`submitAnswer` devuelve `{attempt, feedback}`. `feedback` es `null` salvo corrección automática con visibilidad inmediata; en ese caso contiene `{points:{numerator,denominator}, explanation, maximum, correct}`. El adaptador puede devolver `attempt` para conservar su interfaz y guardar la retroalimentación por separado. No reconstruir la retroalimentación leyendo el estado local ni calcular notas del estudiante con un conjunto de respuestas incompleto.

Los intentos del snapshot estudiantil pertenecen únicamente al usuario y contienen `answers[].reviews: []`. En `studentActivities`, `questions` y los bloques de quiz ya tienen el orden autorizado del intento. `studentResults` conserva `grade: null` cuando no hay nota publicada. Las soluciones, guías, pistas sin consumir y correcciones ocultas nunca viajan en esos mapas. Los docentes reciben sus versiones y correcciones completas.

El snapshot añade `teams`, `incidents`, `readings` y `draftEvaluations` fuera de `state`. `readings` incluye `{id,subjectId,title,content}`; el contenido es una versión sin secretos. `teams` docentes incluye `{id,activityId,name,studentIds}`. `incidents` contiene resoluciones y cantidad de señales; son indicios, sin sanción automática.

`participants` contiene, solo para el docente propietario, `{id,activityId,studentId,alias}`. Su `id` permite ampliar un plazo individual sin confundir cuenta y participación. `autoTeams(activityId,teamCount)` distribuye aleatoriamente la lista aprobada con diferencia máxima de tamaño de uno y permite después `configureTeams`.

`requestMembership` puede devolver `{error:{code,message}}` para `CODE_INVALID` y `RATE_LIMIT`. El cliente debe convertirlo en error visible; responder HTTP 429 para el segundo. No lanzar una excepción SQL en estos dos casos: es necesario confirmar el contador de intentos inválidos. Hay una relación técnica adicional, `join_request_checks`, separada de las 44 relaciones del dominio; guarda únicamente cuenta y hora, se depura a los diez minutos.

## Archivos

Bucket privado `aulify-files`. La ruta es `<auth.uid()>/<file UUID>` y jamás un nombre de archivo del cliente. Subida desde servidor autorizado, inspección de firma/tamaño y registro de metadatos mediante contrato interno antes de confirmar entrega. `submitTask` usa únicamente IDs de objetos previamente validados; no convierte metadatos del cliente en prueba de subida. Un endpoint autorizado genera URLs firmadas después de comprobar la referencia vigente. No emitir URLs públicas.

Después de subir y validar bytes, el servidor llama `aulify_register_file(p_owner,p_id,p_name,p_mime,p_size,p_sha256)` usando una credencial privada de servicio. Es la única operación de registro y no está concedida a cuentas normales. El servidor verifica la identidad y la obtiene de la sesión, nunca de `p_owner` enviado por el navegador. La respuesta es `{id,name,size,mimeType}`. `aulify_file(p_id)` con JWT del usuario devuelve `{id,bucket,path,name,mimeType,size}` solamente si conserva permiso; usar esa autorización antes de crear una URL temporal.

Antes de emitir un enlace de subida, reservar mediante `aulify_reserve_upload(p_owner,p_id,p_name,p_purpose,p_size,p_mime)`, exclusiva del servicio. Propósito `resource` admite imágenes y docente, máximo 5 MiB; `submission` admite los tipos de tarea, máximo 10 MiB. Hasta veinte reservas por cuenta por minuto; reserva de 24 horas. La respuesta `{id,bucket,path,expiresAt}` se utiliza para generar el enlace firmado de carga directa, evitando límites de cuerpo del alojamiento web. `register_file` completa esa reserva y exige mismo propietario, tamaño y tipo, objeto existente y firma SHA-256 verificada por el endpoint. Un reintento idéntico es seguro; no permite sustituir bytes ya registrados. Mantenimiento recoge las reservas incompletas vencidas y sus objetos.

Un bloque imagen guarda `fileId`; el servidor genera `/api/files/<id>` al entregar contenido. El borrador conserva referencias en `draft_files`, evitando que la limpieza de objetos huérfanos borre imágenes en edición.

### Conservación y operación

`aulify_maintenance('tick',{})` es exclusiva del servicio. Materializa vencimientos, depura señales y elimina las relaciones de materias archivadas vencidas. Devuelve hasta cien archivos exclusivos pendientes de borrar. El proceso elimina los objetos mediante Storage y llama `aulify_maintenance('confirmFiles',{ids:[...]})`; el servidor comprueba que esos bytes ya no existan antes de eliminar metadatos y completar el trabajo. Una caída mantiene los objetos pendientes para el siguiente intento. Ejecutar al menos cada seis horas para disponer de margen frente al objetivo de 24 horas. `tools/datos/maintenance.mjs` implementa el consumidor con variables privadas de entorno; la creación del script no equivale a tener el horario configurado.

## Límites de verificación

El contrato y las migraciones requieren ejecución de pruebas; su existencia no acredita despliegue, SMTP ni integración de interfaz. Las funciones que manejan almacenamiento necesitan comprobarse con el servicio Storage real, además del PostgreSQL aislado.
