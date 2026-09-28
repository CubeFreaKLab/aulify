# Diagnóstico de las lecturas y confirmaciones SQL

Fecha: 28 de septiembre de 2026. Estado: diagnóstico y prototipo local; ningún cambio remoto.

La serialización repetida de los intentos es un costo relevante de la lectura docente en el escenario aislado. Un prototipo que reúne esos datos por conjuntos reduce la mediana de esa lectura de **35,53 a 21,91 ms**. Esto justifica preparar una optimización pequeña y verificable; todavía no demuestra que se cumpla la capacidad Q-06.

## Alcance y reproducción

```sh
node tools/datos/sql-profile.mjs
```

El programa crea una base PGlite 0.5.8 en memoria y aplica las doce migraciones hasta `20260928083904`. No lee credenciales ni utiliza la red. Crea una materia, un docente, un docente ajeno y cincuenta estudiantes; cada estudiante tiene un intento de diez preguntas de selección y ocho respuestas automáticas, con resultados ocultos. La pregunta novena sirve para medir una respuesta ordinaria y la décima para medir el cierre. La duración individual está desactivada.

Cada medición tiene cuatro ejecuciones previas y treinta muestras. Las rutas completas se ejecutan como `authenticated`. Los componentes internos se miden como `postgres`, con la identidad ficticia configurada; no constituyen verificaciones de permisos por sí mismos. La medición de escritura incluye `SET CONSTRAINTS ALL IMMEDIATE`, para contabilizar los triggers diferidos, y revierte la transacción después de cada muestra.

Evidencia: [resultados íntegros](datos-perfil-sql-aislado.json), [programa de medición](../../tools/datos/sql-profile.mjs) y [consulta del prototipo](../../tools/datos/profile-attempts-setbased.sql). El JSON conserva las fases descartadas y las 26 comprobaciones de equivalencia, rechazo e idempotencia; no es una suite de seguridad completa.

## Resultados observados

| Operación | Actual p50 | Actual p95 | Propuesta mínima p50 | Propuesta mínima p95 |
|---|---:|---:|---:|---:|
| Sincronización estudiante | 0,45 ms | 0,87 ms | 0,47 ms | 1,58 ms |
| Lectura estudiante | 4,76 ms | 7,27 ms | 4,61 ms | 6,63 ms |
| Sincronización docente | 0,45 ms | 0,49 ms | 0,44 ms | 0,50 ms |
| Lectura docente | 35,53 ms | 36,75 ms | 21,91 ms | 23,26 ms |

La propuesta mínima solo cambia cómo se reúnen los intentos del docente. La autorización, el digest y la ruta estudiantil conservan su implementación original. Las diferencias pequeñas de estas rutas intactas muestran la variación del entorno; no deben presentarse como mejoras del prototipo.

Como componentes separados, las cincuenta llamadas a `attempt_json` tienen una mediana de 38,40 ms; la consulta por conjuntos, 15,69 ms. La exploración de plazos de cincuenta intentos tiene una mediana de 1,80 ms y la versión con soluciones para el docente, 1,31 ms. Estas fases se ejecutan separadamente y sus tiempos no se deben sumar ni convertir en porcentajes del tiempo total.

| Confirmación | p95 incluyendo triggers diferidos | Incrementos de la fila docente compartida |
|---|---:|---:|
| Respuesta automática ordinaria | 2,36 ms | 2 |
| Última respuesta y cierre del intento | 2,61 ms | 3 |
| Repetición con la misma clave y contenido | No usada como muestra de latencia | 0 |

Los incrementos se comprobaron consultando los contadores antes y después de ejecutar los triggers. No son una estimación derivada del número de líneas de código.

## Hallazgos del código

1. **Lectura docente.** `activity_snapshot` llama a `attempt_json` para cada intento. Cada llamada vuelve a buscar actividad, pertenencia, plazo, órdenes de preguntas, respuestas y revisiones. Con cincuenta alumnos se repiten esos recorridos cincuenta veces. La consulta alternativa reúne los intentos autorizados, preguntas asignadas, respuestas, revisiones, órdenes y ampliaciones en conjuntos limitados a una sola actividad.
2. **Autorización y sincronización.** `activity_snapshot` llama a `activity_sync` solo para comprobar acceso y descarta su resultado. Luego vuelve a leer actividad y materia. Se ensayó sustituirlo por la misma comprobación de acceso actual, y también unir varias lecturas internas de `activity_sync`. Ninguno produjo una ganancia clara en este escenario: se descartaron de la propuesta mínima.
3. **Vista estudiantil.** El snapshot arma el intento y la actividad; después `student_activity` vuelve a generarlos. Además, `version_json(false)` construye preguntas que se sustituyen por las obtenidas mediante `present_question`. Hay trabajo repetido, pero el costo aislado es menor que el de la vista docente. Aplicar el agregado de cincuenta intentos también al estudiante empeoró su lectura, de 4,76 a 5,88 ms de mediana; se conservó su ruta original.
4. **Contador compartido.** `track_sync_revision` reacciona tanto a `responses` como a `question_grades`; ambos llaman a `bump_sync_revision` y actualizan la misma fila de `activity_sync_versions`. El cierre añade el evento de `attempts`. Los triggers son diferidos, por lo que esas actualizaciones están en el camino de confirmación de la transacción. La fila compartida puede serializar escritores concurrentes. PGlite no permite medir aquí esa contención: todavía no está demostrada como causa del retraso remoto.
5. **Validación de una respuesta.** `score_answer` construye `question_json` para comparar únicamente el tipo. Puede sustituirse por una correspondencia entre `questions.kind` y el nombre del tipo, manteniendo todas las validaciones posteriores. Es un candidato pequeño, separado de la optimización de lecturas; este informe no cuantifica su mejora.

Referencias de implementación: [snapshot, sync y contador](../../supabase/migrations/20260928083328_aulify_scoped_activity_sync.sql), [triggers vigentes](../../supabase/migrations/20260928083904_aulify_private_lock_revision.sql), [confirmación con orden de bloqueo](../../supabase/migrations/20260928080625_aulify_guided_answer_close_lock.sql) y [serializadores originales](../../supabase/migrations/20260928064810_aulify_commands.sql).

## Cambio recomendado y condiciones de verificación

La primera optimización propuesta es un helper privado para reunir los intentos de la actividad **solo cuando la cuenta es su docente propietario**. `activity_snapshot` conserva su validación actual y la misma forma de respuesta. No se cambia `submit_answer`, su ACK autoritativo, su clave idempotente, los bloqueos de preguntas/intentos ni los datos visibles para un estudiante. El prototipo no añade tablas.

La comparación local comprueba igualdad del contenido, excluyendo el reloj del transporte y el orden no contractual de la colección de intentos. Antes de convertirlo en migración se requieren además casos con varios intentos, revisiones manuales, omisiones, poderes, plazos individuales y globales, retiros, archivo, resolución de incidencias y datos ajenos. Los helpers nuevos deben revocar `EXECUTE` a los clientes; las rutas públicas conservan la comprobación de acceso vigente. Después correspondería una medición remota breve y controlada, sin reducir los umbrales de Q-06.

Un segundo cambio posible, todavía sin prototipo ni medición de concurrencia, consiste en añadir una revisión docente a `participant_sync_versions`. Las respuestas, correcciones e incidencias privadas actualizarían la fila del participante; la revisión global quedaría para cambios de configuración compartida. El digest docente combinaría la revisión global con la suma de las revisiones de sus participantes. El digest estudiantil seguiría dependiendo solo de su revisión visible y de la revisión pública, nunca de correcciones privadas ni de acciones ajenas.

Esta segunda propuesta necesita validar primero borrados, creación de participantes, correcciones no publicadas, publicación, pertenencia retirada y orden de bloqueo entre operaciones que cambian varias filas. No conviene sustituir los contadores por una marca enviada por el cliente ni saltar controles de pertenencia para hacer más barata una lectura. La idempotencia existente debe seguir produciendo cero escrituras en la repetición del mismo envío.

## Límites de la conclusión

La prueba aislada no incluye PostgREST, red, autenticación, Next.js, concurrencia, límites del plan Free ni espera por conexiones. El tiempo incorpora el transporte local y la serialización de PGlite; no es una medición exclusiva del motor PostgreSQL remoto. El escenario solo tiene una revisión automática por respuesta y un intento por estudiante.

El [diagnóstico del protocolo real](datos-protocolo-60s.md) conserva un p95 de ACK de 3.404,96 ms, aunque sus doscientas confirmaciones se verificaron persistidas. La [comparación entre RPC y HTTP](datos-capas-sync.md) no identificó una única capa responsable. Estos resultados siguen vigentes; la reducción observada en memoria no equivale a resolver el incumplimiento remoto ni a aprobar Q-06.
