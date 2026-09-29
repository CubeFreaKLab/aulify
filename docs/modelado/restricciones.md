# Restricciones y consistencia

Las claves del DBML describen relaciones estructurales. No garantizan por sí solas todos los requisitos de Aulify. Este documento define qué debe convertirse en restricción local, índice, permiso u operación transaccional al escribir las migraciones. Ningún control se considera implementado todavía.

## Reglas por mecanismo

| ID | Invariante | Mecanismo previsto | Evidencia futura |
|---|---|---|---|
| M-01 | Identidad única y perfil teacher/student fijo. Propietario de materia/recurso debe ser docente; solicitante debe ser estudiante confirmado. | FK a Auth, CHECK del rol, operación de alta autorizada; no permitir escritura estudiantil de rol. Confirmación se verifica en Auth. | AC-01 a AC-06. |
| M-02 | Una membresía por materia/estudiante; como máximo una solicitud pendiente incluso después de renovar código. | UK de membresía. Resolver materia desde invitación y serializar solicitudes de esa materia al comprobar pendientes; bloquear renovación/aprobación concurrentes. No proponer un índice SQL que haga JOIN a otra tabla. | AC-04, AC-05; AP-29, AP-37. |
| M-03 | Como máximo un código no revocado por materia y un trabajo de purga activo. | Índices únicos parciales; código histórico único global. Revocar, no borrar código al renovar. | AC-05; AP-31, AP-37. |
| M-04 | Solo la revisión esperada guarda un borrador; una versión publicada es inmutable. | Actualización condicional por `revision`; transacción de publicación. Revocar UPDATE/DELETE de versiones a clientes; purga interna diferenciada. | AC-07 a AC-11. |
| M-05 | Recurso publicable cumple límites, tipos, dependencias y soluciones; lectura no exige quiz. | Validador del documento y transacción de extracción de contenido. Máximo un bloque quiz por versión; un quiz independiente tiene uno. Grupos de preguntas no vacíos; contenido relacionado pertenece a la misma versión. | AC-09, AC-35; AP-02 a AP-08, AP-33. |
| M-06 | Pertenencia, actividad, equipo, intento, pregunta y evaluación no se mezclan entre materias o versiones. | FKs compuestas para elementos/versiones; comprobación transaccional de rutas de pertenencia que atraviesan varias tablas. Restricciones diferidas o funciones cerradas, sin DML directo que las eluda. | AC-06, AC-10, AC-11; AP-20. |
| M-07 | Configuración válida según tipo y ritmo. Lectura sin nota; guiado con un intento y sin mezcla de preguntas por estudiante. | CHECK locales y exclusividad de subtipos verificada al publicar; solo quiz tiene quiz_settings, solo task tiene task_settings. Máximos/pesos positivos, fechas válidas y claves de zona verificadas. | AC-12, AC-36; AP-09, AP-15. |
| M-08 | Desde primer intento/entrega/evaluación se congelan reglas. Ninguna edición compite con inicio. | Bloqueo coordinado de actividad y transición `locked_at`; registrar cambios antes de liberar bloqueo. Extensiones solo amplían plazos abiertos y no reabren intentos. | AC-11, AC-20, AC-36. |
| M-09 | Un intento abierto por participante; secuencia e idempotencia únicas. Respuesta definitiva, sin duplicado ni sustitución por otra clave. | UK por participante/número e índice parcial `closed_at IS NULL`; PK de respuesta por pregunta asignada; clave de petición única y hash comparado. Autorización precede al replay. | AC-16 a AC-19. |
| M-10 | La pregunta recibida es la disponible, del intento y versión correctos, dentro del plazo. | Operación de respuesta comprueba orden, ventana guiada, pertenencia y reloj de servidor; valida IDs y payload tipado. Escritura nunca se corrige por igualdad de texto. | AC-13 a AC-20; AP-03 a AP-10. |
| M-11 | Puntos exactos dentro de máximo; selección de revisiones sin duplicación. | Enteros en numerador/denominador, denominador positivo, comparación racional con máximo. Una evaluación quiz incluye exactamente una revisión completa por cada pregunta asignada, todas del intento fuente. Validar el conjunto, no solo que cada FK exista. | AC-21, AC-22, AC-37; AP-03 a AP-07, AP-14. |
| M-12 | Publicación individual consistente, fuente propia y completa. Nunca publicar una revisión antigua sobre otra más nueva. | Serializar revisiones por participante; publicar solo candidato vigente con `revision_no` mayor que última publicada. Fuente quiz/entrega exclusiva según tipo, manual sin ambas; cero por no participación con motivo y sin intento/entrega que contradiga ese origen. | AC-22 a AC-26, AC-38; AP-24, AP-25. |
| M-13 | Un uso de pista/doble por participante/actividad. | PK `(participant_id, kind)`. Consumo de doble y respuesta en una transacción; pista se registra antes de entregar contenido reservado. Rechazar pregunta ajena o incompatible. | AP-11 a AP-14. |
| M-14 | Equipos sin vacíos, reparto equilibrado antes de ajuste, integrantes de la misma actividad y composición congelada. | UK de miembro por participante, validación al iniciar y bloqueo posterior. El retiro no borra la asociación histórica. | AP-19, AP-20, AP-29. |
| M-15 | Sesión guiada única; como máximo una pregunta abierta; inscripción posterior al comienzo rechazada. | PK de sesión por actividad; índice parcial sobre pregunta abierta; operación de inicio crea intentos idempotentes de inscritos. Repetir cierre no crea omisiones ni correcciones duplicadas. | AP-09, AP-10. |
| M-16 | Entrega atómica con 1–5 archivos válidos, hasta 10 MiB cada uno y 20 MiB totales. | CHECK de posición/tamaño y validación del conjunto en recepción. Subir bytes no equivale a recibir entrega; solo objetos ready entran a una versión. | AP-21 a AP-24. |
| M-17 | Reentrega calificada requiere ventana del mismo participante; archivos y notas anteriores se conservan. | FK de ventana utilizada; verificar fecha, revocación y participante. No borrar versiones al reemplazar. Evitar ventanas activas solapadas mediante operación autorizada. | AP-23, AP-24. |
| M-18 | Retiro/archivo cierran intentos abiertos y exigen resolución; exclusión no devuelve consumos. | Transacción de revocación y cierre; resolución única con acción y motivo. No crear revisión definitiva o ranking final con resolución pendiente. | AP-29, AP-30. |
| M-19 | Restauración antes de 30 días excluye purga; a los 30 días ya no se restaura. | Bloqueo de materia y trabajo, hora de servidor, marca de purga y revalidación por lote. Cancelar trabajo al restaurar; al volver a archivar crear otro con nuevo vencimiento. | AP-30 a AP-32. |
| M-20 | Archivo compartido no se borra mientras haya referencias autorizadas. | FKs restrictivas a `file_objects`; enumerar draft_files, content_blocks y submission_files bajo coordinación de referencias. Borrado de bytes mediante API de Storage y después registro; reintentos seguros. | AP-31, AP-32. |
| M-21 | Señales opcionales, deduplicadas, acotadas y con retención; guía sin efectos de negocio. | Comprobar configuración del intento antes de registrar señal; límites de frecuencia del servicio. Purga de eventos a 30 días del cierre efectivo. Preferencia de ayuda separada del dominio. | AC-31 a AC-34; AP-27, AP-28, AP-34. |

PostgreSQL permite PK, UNIQUE, FK y CHECK; las reglas que dependen de otras filas necesitan mecanismos adecuados. Un CHECK que consulte otras tablas no garantiza esa integridad. Los índices únicos parciales sirven para unicidad condicionada, como un único intento abierto. [Documentación de restricciones](https://www.postgresql.org/docs/current/ddl-constraints.html).

## Detalles que deben quedar explícitos en SQL y operaciones

- Nulabilidad consistente: un cierre tiene fecha y causa; una solicitud decidida tiene fecha y actor; una corrección automática no finge autor humano. Numeradores y denominadores son enteros exactos, aunque el tipo PostgreSQL previsto sea NUMERIC sin escala fija.
- No usar `CHECK(fecha > now())` como vigilancia continua del tiempo. Las fechas se comparan en cada operación y los cierres requieren proceso u operación de lectura/acción que materialice el vencimiento de forma idempotente.
- Validar `item_solutions` por tipo: selección usa booleano; relacionar y espacio con opciones usan destino; secuencia usa posición. Exactamente una forma por fila. Referencias al mismo elemento, ciclos padre/hijo y duplicados de destino incompatibles se rechazan. Escritura no tiene clave de corrección automática.
- La `position` de elementos es orden de autoría, no posición correcta. En ordenar, el orden inicial presentado se prepara sin enviar `expected_position`; no asumir que retirar una columna oculta una solución si otro campo la reproduce.
- Los JSON tienen versión y esquema. Validar conjunto completo de IDs, tipo, tamaño y estructura en publicación/respuesta. Las soluciones y guías no se copian al payload de lectura estudiantil.
- Las FK simples no aseguran que un participante pertenezca a la materia de su actividad. Esa ruta se comprueba al crear y al operar. Tampoco aseguran que un intento fuente sea del participante evaluado o que la ventana usada corresponda a la entrega.
- Una nueva corrección genera fila; las revisiones y fuentes seleccionadas por una evaluación publicada son inmutables. Al publicar comprobar que el candidato no quedó desactualizado por otra corrección concurrente.
- Tras fallar una transacción no se informa éxito. Repetir una operación confirmada devuelve el resultado autorizado original; una clave igual con payload distinto se rechaza. El vencimiento impide nuevos envíos, no transforma un replay de un envío ya confirmado en una segunda respuesta.

## Consultas e índices previstos

| Consulta | Índice candidato; comprobar con datos y EXPLAIN al implementar |
|---|---|
| Materias del docente y filtros | `subjects(owner_id, school_year, course_label)`; búsqueda por nombre se decide por volumen. |
| Materias de estudiante | `memberships(student_id, status)` más UK de pertenencia. |
| Solicitudes pendientes | `join_requests(student_id, status)` e invitación→materia; comprobación de pendientes bajo bloqueo de materia. |
| Biblioteca | `resources(owner_id, updated_at)`; estrategia de búsqueda por título pendiente de medición. |
| Actividades disponibles | `activities(subject_id, published_at, closes_at)`; extensiones requieren cálculo del cierre efectivo. |
| Participación y mejor intento | `participants(activity_id, membership_id)`, `attempts(participant_id, attempt_no)` y abierto único parcial. |
| Orden y respuesta | UK de intento/posición; PK de respuesta; UK de clave de petición. |
| Corrección actual | `question_grades(attempt_question_id, revision_no)`; revisiones publicadas usan vínculo explícito. |
| Última nota publicada | `evaluation_revisions(participant_id, revision_no)` filtrado por `published_at IS NOT NULL`; seleccionar revisión máxima. |
| Archivos referenciados | Índices por `file_id` en los tres tipos de referencia, además de sus PK. |
| Retención y purga | `integrity_events(attempt_id, received_at)`, `purge_jobs(status, due_at, next_retry_at)`; un trabajo activo por materia. |

No duplicar índices que ya crean PK/UK ni prometer una mejora sin medir. Las FK no implican automáticamente un índice útil en su lado dependiente; revisar consultas y borrado.

## Límites transaccionales

Definir un orden de adquisición de bloqueos: materia, actividad, participante, intento y pregunta asignada. Las lecturas compatibles pueden compartir bloqueo; no serializar innecesariamente todas las respuestas de una materia. Inicio, cambio de reglas, archivo y retiro necesitan coordinación con las operaciones que admiten respuestas. Probar interbloqueos, reintentos y latencia: un esquema consistente pero demasiado serial no acredita la meta de carga.

Storage y PostgreSQL no forman una sola transacción de archivos. Las cargas se validan antes de confirmar la entrega; los objetos huérfanos y eliminaciones fallidas necesitan limpieza reintentable. La purga conserva un trabajo operativo mínimo y no declara «completado» mientras falten objetos exclusivos por eliminar.

## Revisiones técnicas de sincronización

Las tablas de revisión tienen PK/FK por actividad o participante, borrado en cascada y contadores no negativos. Solo disparadores internos los actualizan, de forma diferida dentro de la transacción. Una actualización sin cambio de valores no incrementa la revisión. La autorización siempre se consulta en las relaciones vigentes; la revisión opaca solo indica si corresponde descargar una proyección nueva.

Desde el modelo 1.3, el contador docente personal pertenece a `participant_sync_versions`. La huella docente incluye pares de identidad y revisión ordenados por participante; no se usa una suma que pueda coincidir al reemplazar filas. Los eventos públicos o sin participante vigente conservan la revisión común. El borrado de un participante invalida al docente mediante esa marca y el cambio del conjunto. Las pruebas aisladas comprueban que responder no escribe la fila común; los bloqueos entre sesiones y la latencia remota requieren su propio ensayo.

## Destinos del documento editorial

La migración 17 conserva la validación estructural del borrador y la aplica también antes de insertar una versión publicada. Los `href` deben ser cadenas HTTPS, con esquema sin distinción de mayúsculas, autoridad no vacía, hasta 8192 caracteres y sin espacios ni controles. Los ejemplos escritos de código permanecen como texto. Las restricciones de soluciones privadas y archivos internos se conservan. No se modifican versiones existentes ni se añaden relaciones o campos; [pruebas y alcance](../verificacion/enlaces-editor.md).
