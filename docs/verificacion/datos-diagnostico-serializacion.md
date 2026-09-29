# Lectura de actividad y confirmación de respuesta

29 de septiembre de 2026. **Q-06 continúa sin acreditar.** Esta revisión identifica una duplicación de trabajo en las lecturas y comprueba su eliminación en memoria. No modifica la aplicación, las migraciones ni Supabase remoto, y no repite la prueba de carga.

El seguimiento posterior implementa y verifica localmente el contador docente por participante en [su informe independiente](datos-revision-participante.md). Este diagnóstico conserva el estado y resultados previos a esa implementación.

## Qué se comprobó

El [diagnóstico remoto posterior a la migración 14](datos-protocolo-60s-migracion14.md) conserva 200 respuestas confirmadas y recuperadas, sin errores técnicos, con p95 de confirmación de 3.867,53 ms frente al objetivo de 1.500 ms. Son los resultados de ese escenario, no los de esta prueba.

La inspección del código distingue dos caminos:

| Camino | Trabajo observado | Duplicación relevante |
|---|---|---|
| Confirmación de respuesta | `POST /api/commands` llama una vez a `aulify_command`; `submit_answer` devuelve el intento mediante una llamada a `attempt_json`. | No llama a `student_activity` ni a `activity_snapshot`. La interfaz usa ese resultado y solicita actualización diferida, sin esperar otra lectura para continuar. |
| Lectura acotada | `GET /api/workspace?activity=…` llama a `aulify_activity_snapshot`. | En el caso estudiantil se reconstruyen el último intento y la actividad dentro de `student_activity` y de nuevo para el estado general. `version_json` reúne preguntas que después se sustituyen por las preguntas presentadas al estudiante. |
| Huella periódica | `GET /api/sync` llama una vez a `aulify_sync`; el cliente descarga contenido al cambiar su huella. | Hay una sola suscripción `useDemo` en `Workspace`, protegida frente a consultas periódicas superpuestas. No se encontró un intervalo repetido por cada componente hijo. |

Fuentes del recorrido: [endpoint de comandos](../../src/app/api/commands/route.ts), [adaptador y sincronización](../../src/demo/store.ts), [interacción del quiz](../../src/components/activity-screen.tsx), [respuesta transaccional](../../supabase/migrations/20260928080625_aulify_guided_answer_close_lock.sql), [proyección acotada](../../supabase/migrations/20260928130653_aulify_teacher_attempt_projection.sql).

## Prueba aislada

Se ampliaron los scripts de diagnóstico existentes para reproducir las quince migraciones, hasta `20260929221908`, en PGlite. El escenario contiene una materia ficticia, cincuenta estudiantes y diez preguntas de selección simple; cada estudiante tiene un intento y ocho respuestas. No se leen credenciales ni se abren conexiones externas.

El prototipo realiza dos cambios temporales: reúne las preguntas presentadas una sola vez y reutiliza el intento y la actividad ya autorizados dentro del mismo resultado. No introduce caché entre solicitudes o usuarios. Las funciones originales se restauran al final y se repite la base para observar variación del entorno.

Cada etapa realiza cuatro lecturas de preparación y treinta mediciones por rol. Se compara el JSON completo, excluyendo únicamente el reloj del transporte y el orden no contractual de la lista de intentos. El tamaño y contenido del resultado permanecieron equivalentes; la proyección estudiantil no mostró soluciones, explicación privada ni guía de corrección. También se comprobó el rechazo de un docente ajeno, un perfil inexistente y la ejecución directa del helper privado.

| Etapa | Estudiante p50 / p95 (ms) | Docente p50 / p95 (ms) |
|---|---:|---:|
| Base | 6,07 / 10,14 | 23,15 / 25,03 |
| Reutilizar preguntas | 5,02 / 5,54 | 23,17 / 28,35 |
| Reutilizar preguntas, intento y actividad | 4,30 / 6,12 | 22,86 / 26,20 |
| Base restaurada | 5,61 / 8,72 | 22,72 / 23,85 |

Para separar el riesgo de confirmación, se midió también el envío de la novena respuesta. Cada muestra ejecuta los triggers diferidos con `SET CONSTRAINTS ALL IMMEDIATE` y luego revierte la transacción. Se conservan doce tiempos tras cuatro preparaciones por etapa. El reloj excluye la preparación, la lectura diagnóstica del contador y el rollback. No incluye durabilidad de un commit ni concurrencia.

| Etapa | Comando p50 / p95 (ms) | Incrementos del contador docente |
|---|---:|---:|
| Base | 2,68 / 3,13 | 2 |
| Reutilización completa | 2,72 / 3,55 | 2 |
| Base restaurada | 2,59 / 2,98 | 2 |

Se aprobaron catorce comprobaciones del ejecutor. Las diferencias temporales del comando no representan una mejora: su función no fue modificada por el prototipo. La primera ejecución sirvió para incorporar esta medición y la segunda añadió la comprobación explícita de los incrementos; la tabla y el archivo enlazado corresponden a esta última ejecución.

[Resultado íntegro](datos-serializacion-estudiante-aislada.json) · [Ejecutor](../../tools/datos/student-serialization-profile.mjs) · [SQL experimental](../../tools/datos/profile-student-serialization.sql).

## Interpretación y siguiente cambio justificable

La reutilización reduce trabajo de lectura en este escenario, pero **no corrige directamente la confirmación de respuesta**. No es motivo suficiente para repetir una carga extensa ni para afirmar que la base remota alcanza el objetivo. Antes de convertirla en migración faltarían casos con los demás tipos de pregunta, varios intentos, mezcla, vencimiento y retroalimentación; el script conserva ese límite.

El comando automático sí actualiza dos veces una fila compartida por la actividad: el trigger de `responses` y el de `question_grades` incrementan `activity_sync_versions.teacher_revision`. La comprobación aislada confirmó los dos incrementos para una respuesta que no cierra el intento ni consume un potenciador. Otros comandos pueden generar una cantidad distinta. Los cincuenta estudiantes de una actividad compiten por la misma fila al terminar su transacción; la existencia de esa escritura compartida es verificable, pero su contribución a los 3.867,53 ms remotos todavía no está medida.

Si se continúa con optimización del ACK, el candidato útil es **separar la revisión docente de cada participante**:

1. Incorporar un contador docente al registro técnico del participante. Los cambios de respuesta, revisión y progreso personal actualizarían esa fila; los cambios comunes de configuración y sesión conservarían el contador de actividad.
2. Para la huella docente, combinar la revisión común con las revisiones de los participantes mediante un agregado estable y ordenado. Son cincuenta registros en el escenario previsto, consultados por un docente; los estudiantes continuarían consultando solo su revisión autorizada.
3. Mantener invisibles para el estudiante los cambios de corrección privada. Verificar aprobación/retiro, publicación, incidencias, potenciadores, cambios de equipo y cierre guiado. No eliminar la validación de pertenencia ni los bloqueos que coordinan respuesta y cierre.
4. Comprobar en aislamiento que dos participantes no necesitan escribir la misma fila técnica al responder, que una corrección privada solo invalida al docente y que publicar sí invalida al estudiante. Medir después un único diagnóstico comparable, antes de decidir la ejecución completa de Q-06.

Esta propuesta requiere una migración y regresiones propias; **no está implementada ni aprobada por una medición remota**. Solo combinar los dos incrementos de una respuesta reduciría escrituras, pero mantendría la fila compartida y no demostraría que desaparezca la espera entre participantes.

La [comparación por capas](datos-capas-sync.md) encontró latencia también en REST directo a Supabase. Esos tiempos incluyen red, PostgREST y PostgreSQL: no permiten atribuir todo al proxy, a SQL o al plan Free. Los bloqueos de relación del [observador v1](datos-observacion-bloqueos.md) son inválidos por el defecto documentado; no se utilizan aquí como prueba de contención.

La recomendación de medir planes y trabajo del motor sigue la [guía oficial de optimización de Supabase](https://supabase.com/docs/guides/database/query-optimization). El [changelog](https://supabase.com/changelog) fue consultado para este diagnóstico; no se cambió la versión del servidor ni se aplicaron extensiones. La prueba de capacidad completa conserva sus usuarios, duración y umbrales originales.
