# Revisiones acotadas a las respuestas de la actividad

29 de septiembre de 2026; aplicación remota verificada el 30 de septiembre a las 00:06 UTC. La migración `20260930000631_aulify_teacher_review_projection.sql` reemplaza únicamente `app.activity_attempts_json`. No cambia tablas, índices, RLS, wrappers, huellas ni comandos; el modelo conserva la versión **1.3**.

## Evidencia y cambio

El plan de la proyección docente de una actividad ficticia con cincuenta participantes y diez preguntas recorría las **8.824 filas de `question_grades`** para presentar cincuenta respuestas. El agregado de revisiones unía todas las preguntas asignadas y elegía un barrido global, aunque solo las preguntas respondidas aparecen en `answers`.

La nueva consulta agrega revisiones mediante `LATERAL` para cada respuesta existente. En el plan observado utiliza el índice ya existente `question_grades_attempt_question_id_revision_no_key`: cincuenta búsquedas de una fila. Mantiene `where teacher`, todas las revisiones ordenadas por número, sus comentarios y el array vacío cuando no hay correcciones. Las correcciones por omisión siguen sin inventar respuestas.

La comparación remota se realizó exclusivamente con consultas `SELECT` y `EXPLAIN`, sobre datos ficticios existentes. El JSON completo de cincuenta intentos resultó equivalente: **122.038 bytes** en ambas variantes. Para compararlo se ordenó únicamente la lista externa de intentos por identificador; no se reordenaron preguntas, respuestas ni revisiones.

| Consulta aislada | Planificación (ms) | Ejecución (ms) | Acceso a revisiones |
|---|---:|---:|---|
| Base inicial | 8,100 | 301,899 | Barrido de 8.824 filas |
| Variante | 6,753 | 13,911 | 50 búsquedas mediante índice |
| Base como control posterior | 27,825 | 31,611 | Barrido de 8.824 filas |

Los tiempos de otros recorridos, que no se modificaron, también variaron. No se atribuye una reducción porcentual fija al cambio. La mejora demostrada es eliminar el barrido global de revisiones de otras actividades; el control posterior evita interpretar la primera muestra como una base estable. El barrido de `responses` permanece: no se añadió otro cambio sin evidencia suficiente.

## Verificación local

El [ejecutor específico](../../tools/datos/teacher-review-projection-check.mjs) reprodujo diecisiete migraciones, creó datos ficticios y comparó el estado antes y después de la nueva migración en PGlite. Pasaron **23 comprobaciones**:

- Equivalencia completa del snapshot docente y de dos estudiantes, además del helper docente, su variante sin privilegio docente y una actividad sin intentos.
- Varias revisiones de una respuesta, su orden y comentarios; respuesta escrita sin revisión; intento sin respuestas; corrección por omisión sin fila de respuesta; varios intentos por estudiante.
- Orden contractual de preguntas y respuestas y exclusión de datos de otra actividad.
- Ausencia de revisión privada, solución y guía en la proyección estudiantil; rechazo de docente ajeno, estudiante no aprobado, anónimo e invocación directa del helper por clientes.
- Conservación del helper privado `SECURITY DEFINER` con `search_path` vacío.

La [regresión del modelo](datos-regresion-proyeccion-revisiones.json) aprobó **84 comprobaciones** con las dieciocho migraciones locales, incluidos snapshot acotado docente, ocho tipos de pregunta, publicación, idempotencia y permisos. No se modificó el formato del ACK.

La primera preparación del fixture intentó revisar una respuesta con su intento abierto y fue rechazada por `ATTEMPT_OPEN`; se corrigió el orden del escenario, cerrando el intento ficticio antes de revisarlo. El resultado enlazado corresponde a la ejecución corregida.

SQL generado mediante `supabase migration new`; SHA-256: `75070a9dddba44f22a1b5e17af502d7662a0348f88402a5691b0f0a0e3be1b99`.

## Alcance del diagnóstico

Las estadísticas remotas de `pg_stat_statements` están acumuladas desde el 28 de septiembre y mezclan revisiones. Registraban medias de 18,386 ms para huella, 108,567 ms para snapshot acotado y 66,018 ms para comandos. No permiten reconstruir el tiempo SQL de cada solicitud del sondeo anterior. No aparecieron lecturas temporales ni JIT en esos agregados. Los planes aislados no reprodujeron concurrencia, red ni espera de conexiones.

Esta mejora afecta al snapshot docente. **No demuestra que se haya resuelto el ACK lento ni aprueba Q-06.** La instrumentación de errores y un build coherente siguen siendo necesarios antes de otro sondeo. En esta unidad no se ejecutó carga ni se reconstruyó o reinició el servidor.

## Aplicación remota

Supabase registró la migración con versión `20260930000631`; el archivo generado inicialmente por CLI tenía versión `20260929235447`. Se alineó el nombre local con el registro remoto, conservando exactamente el SQL y su SHA-256. Los JSON de las pruebas previas conservan el nombre original para identificar la ejecución real.

Antes y después se comparó una proyección docente de cincuenta intentos ficticios existentes, ordenando únicamente la lista externa por identificador. Ambas devolvieron 119.037 bytes y el mismo resumen `950aa86d422db8f082d033681a3c4266`; este caso es distinto de la comparación aislada de 122.038 bytes. El helper sigue sin permiso de ejecución para `anon` y `authenticated`. La lista remota contiene dieciocho migraciones.

El asesor de seguridad conserva los avisos anteriores: 41 informativos de RLS sin políticas en el esquema privado y un aviso de protección de contraseñas filtradas no habilitada. No se habilitó un plan de pago ni acceso directo a tablas. [Criterio del asesor para RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

[Migración aplicada](../../supabase/migrations/20260930000631_aulify_teacher_review_projection.sql) · [Resultado específico](datos-proyeccion-revisiones-docente.json) · [Planes y métricas](datos-planes-rpc-20260929.json) · [Sondeo previo](datos-protocolo-60s-migracion16.md).
