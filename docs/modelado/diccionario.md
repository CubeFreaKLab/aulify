# Diccionario del modelo lógico

Generado desde [modelo.json](modelo.json). Tipos PostgreSQL previstos; no existe todavía una migración aplicada. PK = clave primaria; UK = unicidad; FK = clave foránea. Las reglas que necesitan transacciones o índices parciales están en [restricciones](restricciones.md).

## Identidad externa

### auth.users

Identidad administrada por Supabase Auth; no crear esta tabla en migraciones propias.

PK: `id`.
Acceso: proveedor.
Reglas: administración del proveedor.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador externo de autenticación. |

## Identidad y pertenencia

### profiles

Perfil de producto, sin duplicar contraseñas ni correo de Auth.

PK: `id`.
Acceso: propio y docente con relación vigente.
Reglas: CU-01.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Mismo identificador que auth.users. |
| `display_name` | `varchar(120)` | No | Nombre visible; no acredita identidad institucional. |
| `role` | `varchar(16)` | No | teacher o student; fijo después del registro. |
| `created_at` | `timestamptz` | No | Alta del perfil. |

- FK `id` → `auth.users(id)`; eliminación prevista: `restrict`.

### subjects

Materia de un docente con curso y año como atributos.

PK: `id`.
Acceso: restringido.
Reglas: CU-02, IN-04, IN-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador de materia. |
| `owner_id` | `uuid` | No | Docente propietario. |
| `name` | `varchar(120)` | No | Nombre; no es único. |
| `course_label` | `varchar(80)` | No | Curso o grupo usado para filtros. |
| `school_year` | `smallint` | No | Año de la materia. |
| `created_at` | `timestamptz` | No | Creación. |
| `archived_at` | `timestamptz` | Sí | Archivo; nulo significa activa. |
| `purge_started_at` | `timestamptz` | Sí | Inicio de eliminación; impide restaurar. |

- FK `owner_id` → `profiles(id)`; eliminación prevista: `restrict`.

### invitation_codes

Códigos actuales y revocados, de lectura exclusiva del propietario.

PK: `id`.
UK: `code`.
Acceso: solo propietario mediante operación autorizada.
Reglas: CU-03, CU-06.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `subject_id` | `uuid` | No | Materia de destino. |
| `code` | `varchar(8)` | No | Código aleatorio; identifica solicitud, no autentica. |
| `created_at` | `timestamptz` | No | Generación. |
| `revoked_at` | `timestamptz` | Sí | Desactivación o renovación. |

- FK `subject_id` → `subjects(id)`; eliminación prevista: `cascade`.

### join_requests

Historial de solicitudes; aceptar no reemplaza la membresía estable.

PK: `id`.
Acceso: restringido.
Reglas: CU-04, CU-06.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `invitation_id` | `uuid` | No | Código utilizado; conservar tras renovación. |
| `student_id` | `uuid` | No | Solicitante estudiante. |
| `status` | `varchar(16)` | No | pending, approved o rejected. |
| `requested_at` | `timestamptz` | No | Solicitud. |
| `decided_at` | `timestamptz` | Sí | Decisión; nulo mientras pendiente. |
| `decided_by` | `uuid` | Sí | Docente que decidió. |

- FK `invitation_id` → `invitation_codes(id)`; eliminación prevista: `cascade`.
- FK `student_id` → `profiles(id)`; eliminación prevista: `restrict`.
- FK `decided_by` → `profiles(id)`; eliminación prevista: `restrict`.

### memberships

Una pertenencia estable por materia y estudiante; reingreso reutiliza su identidad.

PK: `id`.
UK: `subject_id, student_id`.
Acceso: restringido.
Reglas: CU-04, CU-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador estable de pertenencia. |
| `subject_id` | `uuid` | No | Materia. |
| `student_id` | `uuid` | No | Estudiante. |
| `status` | `varchar(16)` | No | approved o withdrawn. |
| `created_at` | `timestamptz` | No | Primera aprobación. |
| `updated_at` | `timestamptz` | No | Último cambio. |

- FK `subject_id` → `subjects(id)`; eliminación prevista: `cascade`.
- FK `student_id` → `profiles(id)`; eliminación prevista: `restrict`.

### membership_events

Eventos de aprobación, retiro y reingreso sin perder decisiones anteriores.

PK: `id`.
Acceso: restringido.
Reglas: CU-04, CU-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `membership_id` | `uuid` | No | Pertenencia afectada. |
| `request_id` | `uuid` | Sí | Solicitud que causó aprobación; nulo al retirar. |
| `actor_id` | `uuid` | No | Docente responsable. |
| `event_type` | `varchar(16)` | No | approved, withdrawn o rejoined. |
| `reason` | `text` | Sí | Motivo de retiro, si corresponde. |
| `occurred_at` | `timestamptz` | No | Momento de operación. |

- FK `membership_id` → `memberships(id)`; eliminación prevista: `cascade`.
- FK `request_id` → `join_requests(id)`; eliminación prevista: `cascade`.
- FK `actor_id` → `profiles(id)`; eliminación prevista: `restrict`.

### help_progress

Preferencia de guía por cuenta, rol y versión.

PK: `profile_id, guide_key, guide_version`.
Acceso: propio; rol derivado de profiles y catálogo de guías.
Reglas: AY-01, AY-02, AY-03, AY-04.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `profile_id` | `uuid` | No | Cuenta. |
| `guide_key` | `varchar(40)` | No | Recorrido de ayuda. |
| `guide_version` | `integer` | No | Versión positiva. |
| `state` | `varchar(16)` | No | offered, skipped o completed; sin fila significa no ofrecida. |
| `updated_at` | `timestamptz` | No | Último estado. |

- FK `profile_id` → `profiles(id)`; eliminación prevista: `cascade`.

## Autoría y contenido publicado

### file_objects

Metadatos propios de archivos privados; bytes administrados por Storage.

PK: `id`.
UK: `bucket, object_path`.
Acceso: autorización según referencias, no bucket público.
Reglas: RE-06, TA-01, IN-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador usado por referencias. |
| `owner_id` | `uuid` | No | Cuenta que carga. |
| `bucket` | `varchar(63)` | No | Bucket privado. |
| `object_path` | `text` | No | Ruta opaca; no contiene nombres ni correo. |
| `original_name` | `varchar(255)` | No | Nombre de presentación, nunca ruta de escritura. |
| `mime_type` | `varchar(120)` | No | Tipo validado por contenido. |
| `byte_size` | `bigint` | No | Tamaño validado positivo. |
| `sha256` | `varchar(64)` | Sí | Huella del contenido si se calcula. |
| `state` | `varchar(20)` | No | pending, ready o delete_pending. |
| `created_at` | `timestamptz` | No | Inicio de carga. |
| `validated_at` | `timestamptz` | Sí | Validación completa antes de asociar. |

- FK `owner_id` → `profiles(id)`; eliminación prevista: `restrict`.

### resources

Identidad de biblioteca independiente de materias y de cada publicación.

PK: `id`.
Acceso: propietario.
Reglas: RE-01, RE-02.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador de recurso. |
| `owner_id` | `uuid` | No | Docente propietario. |
| `kind` | `varchar(16)` | No | resource o standalone_quiz. |
| `title` | `varchar(120)` | No | Título de trabajo para búsqueda; no cambia versiones previas. |
| `created_at` | `timestamptz` | No | Creación. |
| `updated_at` | `timestamptz` | No | Última edición. |

- FK `owner_id` → `profiles(id)`; eliminación prevista: `restrict`.

### resource_drafts

Documento mutable de autoría; puede contener soluciones y nunca se entrega al estudiante.

PK: `resource_id`.
Acceso: propietario exclusivamente.
Reglas: RE-03.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `resource_id` | `uuid` | No | Recurso, con un borrador actual. |
| `revision` | `bigint` | No | Contador positivo de concurrencia optimista. |
| `schema_version` | `integer` | No | Versión del esquema del documento. |
| `document` | `jsonb` | No | Agregado de edición validado; sin pertenencias ni calificaciones. |
| `updated_at` | `timestamptz` | No | Último guardado confirmado. |

- FK `resource_id` → `resources(id)`; eliminación prevista: `cascade`.

### draft_files

Referencias de archivos del borrador, extraídas y verificadas al guardar.

PK: `resource_id, file_id`.
Acceso: restringido.
Reglas: RE-03, IN-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `resource_id` | `uuid` | No | Borrador. |
| `file_id` | `uuid` | No | Archivo ready del mismo propietario. |

- FK `resource_id` → `resource_drafts(resource_id)`; eliminación prevista: `cascade`.
- FK `file_id` → `file_objects(id)`; eliminación prevista: `restrict`.

### resource_versions

Publicación inmutable; la actividad fija esta versión.

PK: `id`.
UK: `resource_id, version_no`.
Acceso: restringido.
Reglas: RE-04, RE-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador de versión. |
| `resource_id` | `uuid` | No | Recurso de origen. |
| `version_no` | `integer` | No | Secuencia positiva por recurso. |
| `title` | `varchar(120)` | No | Título publicado conservado. |
| `published_at` | `timestamptz` | No | Momento de publicación. |
| `content_schema_version` | `integer` | No | Esquema de contenido usado al publicar. |

- FK `resource_id` → `resources(id)`; eliminación prevista: `restrict`.

### question_groups

Grupos que mantienen juntas explicaciones y preguntas dependientes.

PK: `version_id, group_key`.
UK: `version_id, position`.
Acceso: restringido.
Reglas: PR-03, PR-04.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `version_id` | `uuid` | No | Versión publicada. |
| `group_key` | `uuid` | No | Identidad local estable entre versiones. |
| `position` | `integer` | No | Orden inicial positivo de grupo. |

- FK `version_id` → `resource_versions(id)`; eliminación prevista: `cascade`.

### content_blocks

Bloques públicos de una versión; las soluciones nunca están aquí.

PK: `version_id, block_key`.
UK: `version_id, position`.
Acceso: restringido.
Reglas: RE-02, RE-06, PR-03.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `version_id` | `uuid` | No | Versión publicada. |
| `block_key` | `uuid` | No | Identidad de bloque dentro de la versión. |
| `group_key` | `uuid` | Sí | Grupo de explicación asociada; nulo para contenido general. |
| `position` | `integer` | No | Orden positivo, único en la versión. |
| `kind` | `varchar(16)` | No | heading, text, list, image, video_link o quiz. |
| `body` | `jsonb` | No | Formato de presentación tipado y saneado. |
| `file_id` | `uuid` | Sí | Archivo de imagen; FK real, no URL incrustada. |
| `alt_text` | `text` | Sí | Texto alternativo requerido en imagen. |
| `external_url` | `text` | Sí | HTTPS para video enlazado. |

- FK `version_id` → `resource_versions(id)`; eliminación prevista: `cascade`.
- FK `version_id, group_key` → `question_groups(version_id, group_key)`; eliminación prevista: `restrict`.
- FK `file_id` → `file_objects(id)`; eliminación prevista: `restrict`.

### questions

Consigna y metadatos públicos de cada pregunta publicada.

PK: `version_id, question_key`.
UK: `version_id, group_key, position`.
Acceso: restringido.
Reglas: PR-01, PR-02.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `version_id` | `uuid` | No | Versión. |
| `question_key` | `uuid` | No | Identidad local estable de pregunta. |
| `group_key` | `uuid` | No | Grupo; una independiente usa su propio grupo. |
| `position` | `integer` | No | Posición dentro del grupo. |
| `kind` | `varchar(24)` | No | single, multiple, boolean, match, order, gap_choice, gap_text u open. |
| `prompt` | `jsonb` | No | Consigna con formato saneado; no solución. |
| `max_points` | `numeric(10,2)` | No | Valor positivo de la pregunta. |
| `correction_mode` | `varchar(16)` | No | automatic o manual; escritura exige manual. |

- FK `version_id, group_key` → `question_groups(version_id, group_key)`; eliminación prevista: `cascade`.

### question_items

Opciones, extremos de pares, elementos de secuencia o espacios; no incluye posición correcta.

PK: `version_id, question_key, item_key`.
UK: `version_id, question_key, position`.
Acceso: restringido.
Reglas: PR-01, PR-04.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `version_id` | `uuid` | No | Versión. |
| `question_key` | `uuid` | No | Pregunta. |
| `item_key` | `uuid` | No | Identificador local de opción/elemento. |
| `parent_item_key` | `uuid` | Sí | Espacio al que pertenece una opción de completar. |
| `kind` | `varchar(16)` | No | choice, left, right, sequence o gap. |
| `position` | `integer` | No | Orden de autoría para representación, no solución de secuencia. |
| `label` | `text` | No | Texto mostrado. |

- FK `version_id, question_key` → `questions(version_id, question_key)`; eliminación prevista: `cascade`.
- FK `version_id, question_key, parent_item_key` → `question_items(version_id, question_key, item_key)`; eliminación prevista: `restrict`.

### question_secrets

Guía manual, explicación de respuesta y pista; superficie privada separada.

PK: `version_id, question_key`.
Acceso: docente; estudiante solo proyección autorizada.
Reglas: PR-01, JU-01, JU-02, JU-04.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `version_id` | `uuid` | No | Versión. |
| `question_key` | `uuid` | No | Pregunta. |
| `manual_guide` | `text` | Sí | Guía privada obligatoria para escritura. |
| `feedback` | `text` | Sí | Explicación reservada según visibilidad. |
| `hint` | `text` | Sí | Pista liberable con consumo autorizado. |

- FK `version_id, question_key` → `questions(version_id, question_key)`; eliminación prevista: `cascade`.

### item_solutions

Solución relacional por elemento: acierto, pareja/opción de espacio o posición esperada.

PK: `version_id, question_key, item_key`.
Acceso: docente; estudiante solo revisión autorizada.
Reglas: PR-01, PR-02, IN-01.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `version_id` | `uuid` | No | Versión. |
| `question_key` | `uuid` | No | Pregunta. |
| `item_key` | `uuid` | No | Elemento evaluado. |
| `is_correct` | `boolean` | Sí | Selección o verdadero/falso. |
| `target_item_key` | `uuid` | Sí | Pareja derecha u opción correcta del espacio. |
| `expected_position` | `integer` | Sí | Posición correcta en secuencia. |

- FK `version_id, question_key, item_key` → `question_items(version_id, question_key, item_key)`; eliminación prevista: `cascade`.
- FK `version_id, question_key, target_item_key` → `question_items(version_id, question_key, item_key)`; eliminación prevista: `restrict`.

## Actividades y disponibilidad

### activities

Asignación a materia; lectura, quiz, tarea o actividad manual.

PK: `id`.
Acceso: restringido.
Reglas: RE-04, RE-05, AC-01, AC-02, TA-01, TA-04.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador de actividad. |
| `subject_id` | `uuid` | No | Materia propietaria. |
| `kind` | `varchar(16)` | No | reading, quiz, task o manual. |
| `version_id` | `uuid` | Sí | Versión obligatoria para reading/quiz; ausente para task/manual. |
| `title` | `varchar(120)` | No | Nombre de la actividad. |
| `instructions` | `text` | Sí | Consigna de tarea/actividad manual. |
| `opens_at` | `timestamptz` | Sí | Disponibilidad; nulo en actividad manual. |
| `closes_at` | `timestamptz` | Sí | Obligatorio para quiz/tarea publicados. |
| `occurs_on` | `date` | Sí | Fecha de realización manual para informes. |
| `timezone` | `varchar(64)` | No | Zona IANA elegida para mostrar fechas. |
| `max_grade` | `numeric(10,2)` | Sí | Máximo positivo; nulo en reading. |
| `weight` | `numeric(10,2)` | Sí | Peso positivo en evaluadas; nulo en reading. |
| `counts_for_average` | `boolean` | No | Siempre falso en reading. |
| `published_at` | `timestamptz` | Sí | Nulo mientras borrador. |
| `locked_at` | `timestamptz` | Sí | Primer intento/entrega/evaluación; congela reglas. |
| `created_at` | `timestamptz` | No | Creación. |

- FK `subject_id` → `subjects(id)`; eliminación prevista: `cascade`.
- FK `version_id` → `resource_versions(id)`; eliminación prevista: `restrict`.

### quiz_settings

Subtipo de actividad quiz, en relación uno a uno.

PK: `activity_id`.
Acceso: restringido.
Reglas: AC-01, AC-08, JU-01, JU-02, JU-04, JU-05, IN-02.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `activity_id` | `uuid` | No | Actividad tipo quiz. |
| `purpose` | `varchar(16)` | No | practice o exam. |
| `pacing` | `varchar(16)` | No | self_paced o guided. |
| `attempt_limit` | `integer` | No | Positivo; guiado exige uno. |
| `duration_seconds` | `integer` | Sí | Positivo o nulo para desactivar. |
| `manual_closed_questions` | `boolean` | No | Revisión manual de preguntas cerradas. |
| `feedback_policy` | `varchar(16)` | No | immediate, after_close o hidden. |
| `shuffle_groups` | `boolean` | No | Solo individual. |
| `shuffle_options` | `boolean` | No | Solo tipos compatibles. |
| `teams_enabled` | `boolean` | No | Equipos configurados antes del inicio. |
| `ranking_enabled` | `boolean` | No | No permitido con feedback hidden. |
| `streaks_enabled` | `boolean` | No | No permitido con feedback hidden. |
| `sound_allowed` | `boolean` | No | El participante conserva activación voluntaria. |
| `hint_enabled` | `boolean` | No | Un uso por participante/actividad. |
| `double_enabled` | `boolean` | No | Un uso por participante/actividad. |
| `bonus_affects_grade` | `boolean` | No | Nota limitada al máximo. |
| `visibility_tracking` | `boolean` | No | Señal opcional avisada antes del intento. |

- FK `activity_id` → `activities(id)`; eliminación prevista: `cascade`.

### task_settings

Subtipo de actividad que recibe archivos.

PK: `activity_id`.
Acceso: restringido.
Reglas: TA-01, TA-02.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `activity_id` | `uuid` | No | Actividad tipo task. |
| `allow_late` | `boolean` | No | Admisión después de cierre con marca de tardía. |

- FK `activity_id` → `activities(id)`; eliminación prevista: `cascade`.

### participants

Relación estable actividad-membresía; existir aquí no consume intento.

PK: `id`.
UK: `activity_id, membership_id`; `activity_id, alias_no`.
Acceso: restringido.
Reglas: AC-03, AC-08, JU-07, JU-08.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador de participación. |
| `activity_id` | `uuid` | No | Actividad. |
| `membership_id` | `uuid` | No | Membresía de la misma materia. |
| `alias_no` | `integer` | No | Número opaco único por actividad. |
| `room_joined_at` | `timestamptz` | Sí | Inscripción a sala guiada antes de iniciar. |
| `created_at` | `timestamptz` | No | Primera asociación a actividad. |

- FK `activity_id` → `activities(id)`; eliminación prevista: `cascade`.
- FK `membership_id` → `memberships(id)`; eliminación prevista: `cascade`.

### deadline_extensions

Registro inmutable de ampliación global o individual.

PK: `id`.
Acceso: restringido.
Reglas: AC-06, AC-07.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `activity_id` | `uuid` | No | Actividad. |
| `participant_id` | `uuid` | Sí | Destino individual de la misma actividad; nulo para cierre global. |
| `new_deadline` | `timestamptz` | No | Nueva fecha que amplía, nunca acorta. |
| `actor_id` | `uuid` | No | Docente propietario. |
| `reason` | `text` | No | Motivo. |
| `created_at` | `timestamptz` | No | Momento de autorización. |

- FK `activity_id` → `activities(id)`; eliminación prevista: `cascade`.
- FK `participant_id` → `participants(id)`; eliminación prevista: `cascade`.
- FK `actor_id` → `profiles(id)`; eliminación prevista: `restrict`.

### guided_sessions

Una sesión por actividad guiada; control persistente sin depender del docente conectado.

PK: `activity_id`.
Acceso: restringido.
Reglas: AC-08, AC-09.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `activity_id` | `uuid` | No | Actividad guiada. |
| `started_at` | `timestamptz` | Sí | Nulo en sala de espera. |
| `closed_at` | `timestamptz` | Sí | Fin de sesión. |
| `close_reason` | `varchar(20)` | Sí | completed, deadline o teacher_early. |
| `revision` | `bigint` | No | Versión de control para reconexión y concurrencia. |

- FK `activity_id` → `quiz_settings(activity_id)`; eliminación prevista: `cascade`.

### session_questions

Orden común de preguntas y sus ventanas en modo guiado.

PK: `activity_id, position`.
UK: `activity_id, version_id, question_key`.
Acceso: restringido.
Reglas: AC-08, AC-09, PR-04.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `activity_id` | `uuid` | No | Sesión. |
| `position` | `integer` | No | Posición positiva en sesión. |
| `version_id` | `uuid` | No | Versión de la actividad. |
| `question_key` | `uuid` | No | Pregunta. |
| `opened_at` | `timestamptz` | Sí | Apertura por docente. |
| `closed_at` | `timestamptz` | Sí | Cierre; ausente mientras abierta. |

- FK `activity_id` → `guided_sessions(activity_id)`; eliminación prevista: `cascade`.
- FK `version_id, question_key` → `questions(version_id, question_key)`; eliminación prevista: `restrict`.

## Participación y juego

### attempts

Una oportunidad de un participante; el estado no equivale a corrección o publicación.

PK: `id`.
UK: `participant_id, attempt_no`; `request_key`.
Acceso: restringido.
Reglas: AC-03, AC-05, AC-06, IN-07.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `participant_id` | `uuid` | No | Participante estable. |
| `attempt_no` | `integer` | No | Secuencia positiva que no se reinicia al reingresar. |
| `started_at` | `timestamptz` | No | Inicio según servidor. |
| `closed_at` | `timestamptz` | Sí | Nulo mientras abierto. |
| `close_reason` | `varchar(24)` | Sí | submitted, guided_completed, deadline, withdrawal, archive o teacher_early. |
| `request_key` | `uuid` | No | Clave de inicio; autenticación previa a cualquier repetición. |

- FK `participant_id` → `participants(id)`; eliminación prevista: `cascade`.

### attempt_questions

Conjunto y orden congelado por intento, incluso para preguntas omitidas.

PK: `id`.
UK: `attempt_id, position`; `attempt_id, version_id, question_key`.
Acceso: restringido.
Reglas: PR-03, PR-04, AC-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador de pregunta asignada. |
| `attempt_id` | `uuid` | No | Intento. |
| `version_id` | `uuid` | No | Misma versión que actividad, validada al iniciar. |
| `question_key` | `uuid` | No | Pregunta publicada. |
| `position` | `integer` | No | Orden asignado positivo. |
| `item_order` | `jsonb` | No | Listas tipadas de IDs de opciones para presentación; no soluciones. |

- FK `attempt_id` → `attempts(id)`; eliminación prevista: `cascade`.
- FK `version_id, question_key` → `questions(version_id, question_key)`; eliminación prevista: `restrict`.

### responses

Envío definitivo e inmutable; ausencia de fila significa sin respuesta confirmada.

PK: `attempt_question_id`.
UK: `request_key`.
Acceso: propia y propietario; sin solución/nota incrustada.
Reglas: AC-04, AC-05, PR-01, IN-01.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `attempt_question_id` | `uuid` | No | Pregunta asignada; una respuesta como máximo. |
| `request_key` | `uuid` | No | Clave global de idempotencia de envío. |
| `payload_hash` | `varchar(64)` | No | Huella de payload normalizado para rechazar reuso distinto. |
| `payload` | `jsonb` | No | Respuesta tipada: IDs, pares, orden, espacios o texto; nunca puntuación del cliente. |
| `received_at` | `timestamptz` | No | Confirmación según servidor. |

- FK `attempt_question_id` → `attempt_questions(id)`; eliminación prevista: `cascade`.

### attempt_resolutions

Resolución expresa de cierre administrativo.

PK: `attempt_id`.
Acceso: restringido.
Reglas: IN-07.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `attempt_id` | `uuid` | No | Intento cerrado por retiro, archivo o cierre anticipado. |
| `decision` | `varchar(16)` | No | evaluate o exclude. |
| `actor_id` | `uuid` | No | Docente que decide. |
| `reason` | `text` | No | Motivo obligatorio. |
| `decided_at` | `timestamptz` | No | Resolución. |

- FK `attempt_id` → `attempts(id)`; eliminación prevista: `cascade`.
- FK `actor_id` → `profiles(id)`; eliminación prevista: `restrict`.

### teams

Equipos de una actividad antes de congelar composición.

PK: `id`.
UK: `activity_id, name`.
Acceso: restringido.
Reglas: JU-07.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `activity_id` | `uuid` | No | Actividad con equipos habilitados. |
| `name` | `varchar(80)` | No | Nombre visible de equipo. |

- FK `activity_id` → `activities(id)`; eliminación prevista: `cascade`.

### team_members

Cada participante ocupa un equipo de su misma actividad.

PK: `participant_id`.
Acceso: restringido.
Reglas: JU-07, JU-08.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `participant_id` | `uuid` | No | Participante de lista congelada. |
| `team_id` | `uuid` | No | Equipo de la misma actividad. |

- FK `participant_id` → `participants(id)`; eliminación prevista: `cascade`.
- FK `team_id` → `teams(id)`; eliminación prevista: `cascade`.

### powerup_uses

Un consumo por participante/tipo para toda la actividad, no por intento.

PK: `participant_id, kind`.
UK: `request_key`.
Acceso: restringido.
Reglas: JU-04, JU-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `participant_id` | `uuid` | No | Participante. |
| `kind` | `varchar(16)` | No | hint o double. |
| `attempt_question_id` | `uuid` | No | Pregunta donde se consumió, del mismo participante. |
| `request_key` | `uuid` | No | Clave de idempotencia de consumo. |
| `consumed_at` | `timestamptz` | No | Instante de consumo autorizado. |

- FK `participant_id` → `participants(id)`; eliminación prevista: `cascade`.
- FK `attempt_question_id` → `attempt_questions(id)`; eliminación prevista: `cascade`.

## Entregas y evaluación

### question_grades

Correcciones append-only; puede calificar omisión sin inventar respuesta.

PK: `id`.
UK: `attempt_question_id, revision_no`.
Acceso: docente; estudiante solo mediante evaluación publicada/revisión liberada.
Reglas: PR-02, EV-01, EV-02, EV-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador de revisión. |
| `attempt_question_id` | `uuid` | No | Pregunta asignada. |
| `revision_no` | `integer` | No | Secuencia por pregunta asignada. |
| `points_num` | `numeric` | No | Numerador entero no negativo de puntos base exactos. |
| `points_den` | `numeric` | No | Denominador entero positivo; evitar división prematura. |
| `method` | `varchar(16)` | No | automatic, manual u omission. |
| `actor_id` | `uuid` | Sí | Docente en manual; nulo en cálculo automático. |
| `comment` | `text` | Sí | Comentario de evaluación, con visibilidad controlada. |
| `reason` | `text` | Sí | Obligatorio al corregir una evaluación previa. |
| `engine_version` | `varchar(32)` | No | Versión del cálculo/contrato de revisión. |
| `created_at` | `timestamptz` | No | Momento de corrección. |

- FK `attempt_question_id` → `attempt_questions(id)`; eliminación prevista: `cascade`.
- FK `actor_id` → `profiles(id)`; eliminación prevista: `restrict`.

### submissions

Contenedor estable de entrega de tarea por participante.

PK: `id`.
UK: `participant_id`.
Acceso: restringido.
Reglas: TA-01, TA-02.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `participant_id` | `uuid` | No | Participante de actividad tipo task. |
| `created_at` | `timestamptz` | No | Primera recepción válida. |

- FK `participant_id` → `participants(id)`; eliminación prevista: `cascade`.

### submission_versions

Versión recibida completa e inmutable; cargas parciales permanecen fuera.

PK: `id`.
UK: `submission_id, version_no`; `request_key`.
Acceso: restringido.
Reglas: TA-02, TA-03.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `submission_id` | `uuid` | No | Entrega. |
| `version_no` | `integer` | No | Secuencia positiva. |
| `received_at` | `timestamptz` | No | Recepción válida. |
| `deadline_used` | `timestamptz` | No | Plazo efectivo aplicado al recibir; hecho histórico. |
| `resubmission_window_id` | `uuid` | Sí | Autorización utilizada, si era reentrega de tarea calificada. |
| `late` | `boolean` | No | Respecto al cierre general; ampliación se explica separadamente. |
| `request_key` | `uuid` | No | Idempotencia de recepción. |

- FK `submission_id` → `submissions(id)`; eliminación prevista: `cascade`.
- FK `resubmission_window_id` → `resubmission_windows(id)`; eliminación prevista: `cascade`.

### submission_files

Archivos de una versión recibida.

PK: `submission_version_id, file_id`.
UK: `submission_version_id, position`.
Acceso: restringido.
Reglas: TA-01, TA-02.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `submission_version_id` | `uuid` | No | Versión de entrega. |
| `file_id` | `uuid` | No | Objeto validado y autorizado. |
| `position` | `smallint` | No | Posición de uno a cinco. |

- FK `submission_version_id` → `submission_versions(id)`; eliminación prevista: `cascade`.
- FK `file_id` → `file_objects(id)`; eliminación prevista: `restrict`.

### resubmission_windows

Permiso individual explícito para otra versión de tarea calificada.

PK: `id`.
Acceso: restringido.
Reglas: TA-03.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `participant_id` | `uuid` | No | Participante. |
| `opens_at` | `timestamptz` | No | Inicio de autorización. |
| `closes_at` | `timestamptz` | No | Límite individual. |
| `actor_id` | `uuid` | No | Docente autorizante. |
| `reason` | `text` | Sí | Comentario opcional. |
| `revoked_at` | `timestamptz` | Sí | Revocación antes de usar; no borra entrega recibida. |

- FK `participant_id` → `participants(id)`; eliminación prevista: `cascade`.
- FK `actor_id` → `profiles(id)`; eliminación prevista: `restrict`.

### evaluation_revisions

Resultado propuesto y publicación histórica por participante; no sobrescribir nota publicada.

PK: `id`.
UK: `participant_id, revision_no`.
Acceso: docente; titular solo última publicada autorizada.
Reglas: EV-01, EV-04, EV-05, EV-06, EV-07.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador de evaluación. |
| `participant_id` | `uuid` | No | Estudiante en actividad. |
| `revision_no` | `integer` | No | Secuencia de revisión. |
| `source_kind` | `varchar(24)` | No | quiz, submission, manual o nonparticipation. |
| `attempt_id` | `uuid` | Sí | Intento elegido, obligatorio en quiz. |
| `submission_version_id` | `uuid` | Sí | Versión elegida, obligatoria en submission. |
| `grade` | `numeric(10,2)` | No | Nota final redondeada y dentro del máximo. |
| `feedback` | `text` | Sí | Comentario general publicable. |
| `reason` | `text` | Sí | Motivo de corrección o cero por no participación. |
| `actor_id` | `uuid` | No | Docente que prepara la evaluación. |
| `created_at` | `timestamptz` | No | Creación de revisión. |
| `published_at` | `timestamptz` | Sí | Única transición de publicación; nulo significa privada. |

- FK `participant_id` → `participants(id)`; eliminación prevista: `cascade`.
- FK `attempt_id` → `attempts(id)`; eliminación prevista: `cascade`.
- FK `submission_version_id` → `submission_versions(id)`; eliminación prevista: `cascade`.
- FK `actor_id` → `profiles(id)`; eliminación prevista: `restrict`.

### evaluation_question_grades

Correcciones exactas utilizadas por una evaluación de quiz publicada o preparada.

PK: `evaluation_id, question_grade_id`.
Acceso: restringido.
Reglas: EV-04, EV-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `evaluation_id` | `uuid` | No | Evaluación de quiz. |
| `question_grade_id` | `uuid` | No | Revisión concreta de puntuación por pregunta. |

- FK `evaluation_id` → `evaluation_revisions(id)`; eliminación prevista: `cascade`.
- FK `question_grade_id` → `question_grades(id)`; eliminación prevista: `cascade`.

## Integridad y conservación

### integrity_events

Señales opcionales y limitadas de visibilidad; no prueban fraude.

PK: `id`.
UK: `attempt_id, client_event_key`.
Acceso: docente; titular solo explicación de su incidencia.
Reglas: IN-02, IN-06.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `attempt_id` | `uuid` | No | Intento. |
| `client_event_key` | `uuid` | No | Deduplicación de señal del navegador. |
| `hidden_at` | `timestamptz` | No | Inicio indicado por navegador; no autoritativo. |
| `visible_at` | `timestamptz` | Sí | Fin indicado por navegador. |
| `received_at` | `timestamptz` | No | Recepción en servidor. |

- FK `attempt_id` → `attempts(id)`; eliminación prevista: `cascade`.

### incident_reviews

Resolución mínima por intento, separada de detalle de señales que caduca.

PK: `attempt_id`.
Acceso: restringido.
Reglas: IN-03, IN-06.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `attempt_id` | `uuid` | No | Intento revisado. |
| `status` | `varchar(24)` | No | pending, reviewed_no_action o reviewed_observation. |
| `actor_id` | `uuid` | Sí | Docente que revisó. |
| `comment` | `text` | Sí | Observación; no modifica nota automáticamente. |
| `reviewed_at` | `timestamptz` | Sí | Momento de revisión. |

- FK `attempt_id` → `attempts(id)`; eliminación prevista: `cascade`.
- FK `actor_id` → `profiles(id)`; eliminación prevista: `restrict`.

### activity_events

Auditoría mínima de control y cambios autorizados; no sustituye tablas del dominio.

PK: `id`.
Acceso: docente y operación autorizada.
Reglas: RE-05, AC-09, IN-03.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `activity_id` | `uuid` | No | Actividad. |
| `actor_id` | `uuid` | Sí | Cuenta autorizada o nulo en proceso del sistema. |
| `event_type` | `varchar(40)` | No | Tipo permitido: publicación, bloqueo, sesión o revisión de incidencia. |
| `details` | `jsonb` | No | Esquema acotado según evento; sin respuestas, correos, soluciones ni credenciales. |
| `occurred_at` | `timestamptz` | No | Hora de servidor. |

- FK `activity_id` → `activities(id)`; eliminación prevista: `cascade`.
- FK `actor_id` → `profiles(id)`; eliminación prevista: `restrict`.

### subject_events

Auditoría de archivo y restauración con fecha real.

PK: `id`.
Acceso: restringido.
Reglas: IN-04, IN-05.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador. |
| `subject_id` | `uuid` | No | Materia. |
| `actor_id` | `uuid` | No | Propietario. |
| `event_type` | `varchar(16)` | No | archived o restored. |
| `occurred_at` | `timestamptz` | No | Hora de servidor. |

- FK `subject_id` → `subjects(id)`; eliminación prevista: `cascade`.
- FK `actor_id` → `profiles(id)`; eliminación prevista: `restrict`.

### purge_jobs

Trabajo de eliminación reanudable; completa registros y objetos, no solo una cascada SQL.

PK: `id`.
Acceso: solo proceso de operación.
Reglas: IN-05, IN-06.

| Campo | Tipo previsto | Admite nulo | Descripción |
|---|---|---|---|
| `id` | `uuid` | No | Identificador de trabajo. |
| `subject_id` | `uuid` | Sí | Materia mientras existe; nulo después del borrado final. |
| `due_at` | `timestamptz` | No | Archivo más 30 días; se recalcula al archivar nuevamente. |
| `status` | `varchar(16)` | No | scheduled, running, failed, done o cancelled. |
| `phase` | `varchar(24)` | No | Referencias, objetos o registros; fases controladas. |
| `retry_count` | `integer` | No | Reintentos no negativos. |
| `last_error_code` | `varchar(64)` | Sí | Código técnico sin payload sensible. |
| `next_retry_at` | `timestamptz` | Sí | Próximo intento. |
| `completed_at` | `timestamptz` | Sí | Finalización real. |

- FK `subject_id` → `subjects(id)`; eliminación prevista: `set null`.
