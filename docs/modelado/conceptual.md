# Modelo conceptual

El docente organiza una materia para un grupo y año. El estudiante solicita ingreso y adquiere una pertenencia cuando el docente lo aprueba. El recurso pertenece a la biblioteca del docente; la materia recibe una actividad que referencia una versión publicada de ese recurso. Esta separación permite reutilizar contenido sin compartir accidentalmente integrantes, respuestas o notas.

## Entidades y cardinalidades

| Relación | Cardinalidad y sentido |
|---|---|
| Perfil docente — materia | Un docente puede tener cero o muchas materias; cada materia tiene exactamente un propietario. |
| Estudiante — materia | Muchos a muchos mediante membresía. La pareja materia/estudiante es única aunque exista retiro y reingreso. |
| Solicitud — membresía | Las solicitudes conservan decisiones; aprobar crea o reactiva una membresía. Solicitar no concede acceso. |
| Docente — recurso | Un docente conserva una biblioteca de cero o muchos recursos independientes de sus materias. |
| Recurso — borrador y versiones | Un borrador actual como máximo y cero o muchas versiones publicadas. Toda versión pertenece a un recurso. |
| Versión — bloques y preguntas | Una versión contiene bloques. Puede ser lectura sin preguntas; un quiz válido exige al menos una. Las preguntas se agrupan para conservar dependencias al mezclar. |
| Pregunta — elementos y solución | Una pregunta contiene los elementos de su tipo. Sus soluciones y guía están separadas; una respuesta abierta no exige opciones ni corrección automática. |
| Materia — actividad | Una materia contiene cero o muchas actividades; cada actividad pertenece a una sola materia. |
| Actividad — participante | Relación entre actividad y membresía de la misma materia. Puede crearse para equipos, sala o evaluación sin consumir un intento. |
| Participante — intento | Un participante puede realizar varios intentos de quiz, respetando el límite; como máximo uno abierto. |
| Intento — pregunta asignada — respuesta | El intento congela conjunto y orden. Cada pregunta asignada tiene cero o una respuesta confirmada; una omisión se representa sin inventar un envío. |
| Pregunta asignada — corrección | Cero o muchas revisiones de puntos. Ausencia de corrección significa pendiente, no cero. |
| Participante — evaluación | Cero o muchas revisiones. Solo una versión publicada vigente alimenta la consulta y el promedio; una revisión privada posterior no la reemplaza. |
| Participante — entrega | En tarea puede existir un contenedor de entrega con varias versiones recibidas. Cada versión conserva archivos y puede ser fuente de una evaluación. |
| Actividad — equipos | Cero o muchos equipos. Cada participante asignado ocupa un equipo de esa misma actividad; su nota sigue siendo individual. |
| Participante — potenciador | Como máximo una pista y un doble en toda la actividad, independientemente de la cantidad de intentos. |
| Materia — conservación | Archivar conserva temporalmente los datos; purgar elimina dependencias de la materia y archivos exclusivos, preservando biblioteca, otras materias y cuentas. |

## Del concepto a las relaciones

| Concepto | Relaciones del modelo |
|---|---|
| Identidad, pertenencia y ayuda | `profiles`, `subjects`, `invitation_codes`, `join_requests`, `memberships`, `membership_events`, `help_progress`. |
| Biblioteca y publicación | `resources`, `resource_drafts`, `draft_files`, `resource_versions`, `content_blocks`, `question_groups`, `questions`, `question_items`, `question_secrets`, `item_solutions`, `file_objects`. |
| Asignación y disponibilidad | `activities`, `quiz_settings`, `task_settings`, `participants`, `deadline_extensions`, `guided_sessions`, `session_questions`. |
| Participación y juego | `attempts`, `attempt_questions`, `responses`, `attempt_resolutions`, `teams`, `team_members`, `powerup_uses`. |
| Entregas y resultados | `question_grades`, `submissions`, `submission_versions`, `submission_files`, `resubmission_windows`, `evaluation_revisions`, `evaluation_question_grades`. |
| Integridad y ciclo de vida | `integrity_events`, `incident_reviews`, `activity_events`, `subject_events`, `purge_jobs`. |

`auth.users` es identidad administrada por el proveedor. No se copia la contraseña ni se crea una segunda tabla de credenciales. La selección de rol no acredita una identidad institucional; la aprobación controla pertenencia a una materia.

## Decisiones que protegen resultados

**Contenido y uso.** Un recurso puede publicarse y compartirse en varias actividades. La actividad referencia una versión inmutable. Una copia entre materias crea otro recurso con versiones propias; puede reutilizar el objeto de una imagen solo si su autorización y referencias lo permiten.

**Borrador y publicación.** El borrador es un agregado editable con revisión de concurrencia. Publicar lo valida y materializa sus bloques, preguntas, elementos y soluciones en relaciones separadas. No leer el borrador desde una cuenta estudiantil, aunque el recurso tenga una versión publicada.

**Puntos, nota y revisión.** Una respuesta conserva lo enviado. Las correcciones guardan puntos base exactos y versiones; la nota de quiz deriva de esas correcciones. Cada evaluación enlaza las revisiones de puntos utilizadas. Así, publicar 12 y preparar una corrección a 14 mantiene 12 visible hasta una nueva publicación, con el detalle anterior coherente.

**Datos calculados.** Promedio, clasificación, rachas y gráficos son consultas o proyecciones del dominio. No se crean tablas independientes de «promedio» o «ranking» como fuentes paralelas que puedan contradecir notas y respuestas. Si más adelante se necesita caché, deberá tener versión, invalidación y reconstrucción verificables.

**Estados distintos.** Intento cerrado, corrección completa y nota publicada son hechos diferentes. Una sesión terminada puede tener preguntas escritas pendientes. El [diagrama de estados](diagramas/08-estados.svg) muestra esas dimensiones por separado.

**Alcance.** No se modela una universidad, matrícula institucional, trimestre administrativo ni portal familiar. Curso y año son atributos de materia, según el spec. El modelo no añade esas funciones.

## Fechas y cantidades

Usar hora del servidor y `timestamptz` para instantes; conservar la zona IANA elegida para presentación. `occurs_on` expresa la fecha de una actividad manual. La fecha de cierre efectiva resulta del cierre inicial y las ampliaciones registradas; el tiempo del dispositivo no decide admisión.

Puntos parciales se representan como fracciones de enteros, y la nota publicada como decimal de dos cifras. Por ejemplo, un elemento acertado de tres en una pregunta de valor 1 aporta `1/3`, no `0,33` prematuramente. Esta decisión evita acumular redondeos antes del cálculo final; las operaciones se definirán y probarán al implementar.
