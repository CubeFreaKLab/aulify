# Normalización y dependencias

El núcleo relacional busca tercera forma normal: atributos atómicos según su dominio, sin grupos repetidos en columnas y sin dependencias parciales o transitivas innecesarias. Esto no se afirma solo por usar PostgreSQL o por tener UUID. A continuación se explican las dependencias y las excepciones deliberadas del modelo.

## Ejemplo de descomposición

Una hoja única con docente, materia, estudiante, preguntas, respuestas y notas repetiría el nombre de materia por cada respuesta. También obligaría a modificar muchas filas al corregir una materia y podría borrar información de un estudiante al eliminar una entrega.

1. **Primera forma normal:** separar las colecciones en filas: membresías, preguntas, elementos y archivos de entrega. No crear columnas `estudiante1`, `estudiante2`, `pregunta1` o listas de correos.
2. **Segunda forma normal:** en las relaciones con clave compuesta, conservar solo atributos que dependan de toda la clave. El nombre del estudiante depende de su perfil y no de la pareja materia/estudiante; queda en `profiles`.
3. **Tercera forma normal:** retirar dependencias entre atributos no clave. La actividad referencia una materia; no repite su docente, curso y año. Se consultan mediante la relación con `subjects`.

## Dependencias funcionales principales

| Relación o familia | Claves y dependencias | Justificación |
|---|---|---|
| `profiles` | `id → display_name, role, created_at`. | El correo y contraseña pertenecen a Auth. No repetirlos en cada materia. |
| `subjects` | `id → owner_id, name, course_label, school_year, fechas`. | Nombre no es clave: dos materias pueden llamarse igual. |
| `memberships` | `id → subject_id, student_id, status, fechas`; `(subject_id, student_id) → id`. | Dos claves candidatas; sin datos personales ni nombre de materia repetidos. |
| `join_requests` | `id → invitation_id, student_id, decisión, fechas`. | Materia se obtiene por invitación; la regla «una pendiente por materia» requiere una operación coordinada, no un falso índice entre tablas. |
| `help_progress` | `(profile_id, guide_key, guide_version) → state, updated_at`. | El rol se deriva del perfil fijo y del catálogo de guías; no se repite como columna dependiente solo del usuario. |
| `resource_versions` | `id → resource_id, version_no, título, publicación`; `(resource_id, version_no) → id`. | El título publicado es un hecho de esa versión, no una copia que deba seguir el título mutable de biblioteca. |
| `content_blocks` | `(version_id, block_key) → tipo, orden, contenido y referencias`. | La identidad local puede repetirse en versiones diferentes; por eso la clave incluye versión. |
| `questions` | `(version_id, question_key) → group_key, position, tipo, consigna, valor, corrección`. | No repetir guía, soluciones ni respuestas estudiantiles en la consigna. |
| `question_items` | `(version_id, question_key, item_key) → tipo, padre, orden, etiqueta`. | Elementos de relaciones, secuencias y espacios se almacenan como filas con identidad estable. |
| `item_solutions` | Misma clave de elemento → acierto, destino o posición correcta. | La separación permite reservar soluciones y comprobar que los elementos referenciados existen en la misma pregunta. |
| `participants` | `id → activity_id, membership_id, alias, sala`; `(activity_id, membership_id) → id`. | No repite nombre del estudiante ni nota. La igualdad de materia se valida como invariante entre relaciones. |
| `attempts` | `id → participante, número, fechas y causa`; `(participant_id, attempt_no) → id`. | Varios intentos no crean otra pertenencia ni restauran consumos. |
| `responses` | `attempt_question_id → request_key, hash, payload, received_at`. | Una respuesta final por pregunta asignada. Hash es evidencia de identidad del mensaje; no otra respuesta editable. |
| `question_grades` | `id → pregunta asignada, revisión, puntos, método, autor y fecha`; `(attempt_question_id, revision_no) → id`. | Cada revisión es un hecho nuevo. Una corrección no altera el envío original. |
| `powerup_uses` | `(participant_id, kind) → pregunta asignada, clave, fecha`. | Un uso por actividad a través del participante estable, nunca uno por intento. |
| `submission_files` | `(submission_version_id, file_id) → position`. | Resolver muchos a muchos sin guardar rutas separadas por comas; el archivo conserva metadatos en `file_objects`. |

Las demás relaciones de eventos, subtipos y asociaciones siguen el mismo criterio: atributos de un evento dependen de su identidad; las asociaciones puras se determinan por la pareja de claves. El [diccionario](diccionario.md) contiene sus claves concretas.

## Excepciones y datos derivados justificados

| Caso | Motivo y control de coherencia |
|---|---|
| `resource_drafts.document` en JSONB | Agregado de autoría con estructura variable y guardado atómico. No se presenta su contenido interno como relaciones en tercera forma normal. Se valida un esquema y, al publicar, se extraen entidades, elementos y soluciones. |
| `content_blocks.body`, `questions.prompt` | Árboles de presentación: texto, marcas y formato. Sus referencias a archivos y sus soluciones no se dejan dentro de un JSON público ambiguo. |
| `responses.payload` | Valor compuesto de un único envío tipado: conjunto de opciones, parejas, orden o texto. Es inmutable y no contiene relaciones de identidad, permisos o notas. Los IDs se validan contra los elementos asignados. Si se requieren consultas analíticas por elemento, se derivará una proyección sin sustituir el envío original. |
| `attempt_questions.item_order` | Instantánea de presentación por intento. Guarda solo IDs permitidos, sin solución; validar conjunto, duplicados y compatibilidad con el tipo. |
| `deadline_extensions.activity_id` más participante opcional | El participante determina su actividad; en extensiones individuales hay redundancia controlada para compartir el registro con extensiones globales. Verificar igualdad en la operación transaccional. No afirmar tercera forma normal estricta para esta redundancia. |
| Evaluación con `participant_id` y fuente opcional | La fuente de quiz o entrega determina participante; se conserva referencia común para cuatro clases de evaluación. Validar que la fuente corresponda, que sea completa y que respete el tipo. Es una excepción controlada del modelo de evaluación. |
| `evaluation_revisions.grade` | Resultado histórico de un cálculo o decisión manual. Se congela con su fuente y revisiones; no se recalcula la versión publicada al editar otra corrección. El promedio se calcula desde estas publicaciones. |
| `submission_versions.deadline_used` y `late` | Instantánea de las condiciones de recepción. Conserva cómo se admitió la entrega aunque luego se amplíe un plazo. La marca tardía se refiere al cierre general usado al recibir; una ventana individual se identifica mediante su FK. |
| `purge_jobs.due_at` y eventos acotados | Datos operativos/históricos. Coordinar archivo, cancelación y nueva programación bajo bloqueo; no usarlos como una segunda verdad sobre una materia activa. |

PostgreSQL admite JSONB junto con relaciones; aquí su uso se limita a agregados de contenido y presentación con esquemas verificables. No sustituye las claves de pertenencia, intentos, versiones o evaluaciones. [Referencia de tipos JSON](https://www.postgresql.org/docs/current/datatype-json.html).

## Comprobación al implementar

Intentar introducir membresías duplicadas, preguntas de otra versión, respuestas repetidas, dos correcciones seleccionadas para la misma pregunta y evaluaciones ajenas. Verificar que cada excepción conserve su invariante, incluso con operaciones simultáneas. La validación del archivo JSON no demuestra estas restricciones en PostgreSQL; faltan las pruebas del esquema físico.
