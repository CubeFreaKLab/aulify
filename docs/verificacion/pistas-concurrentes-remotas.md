# Pistas simultáneas y consumo único

El 30 de septiembre de 2026 se comprobó AP-12 contra Supabase remoto con una materia ficticia nueva, una cuenta docente y dos sesiones independientes del mismo estudiante. El contrato devolvió una sola pista y PostgreSQL conservó un solo consumo. Las catorce comprobaciones del [registro](pistas-concurrentes-remotas.json) pertenecen a este escenario; no representan catorce casos de aceptación distintos.

## Entorno y procedimiento

Se utilizó el contrato público `aulify_command`, con clave publicable y JWT de usuarios ficticios, sobre las veintitrés migraciones identificadas en el registro. La revisión de referencia del repositorio es `a9973cf`; esta prueba no modifica la aplicación desplegada `1e4160b` ni el esquema. El [ejecutor](../../tools/datos/hint-concurrency-remote.mjs) conserva las fases de preparación, carrera y cierre. Credenciales y sesiones se guardan exclusivamente en el directorio privado ignorado por Git.

1. El docente creó una materia y aprobó la incorporación del estudiante. Publicó tres preguntas de verdadero/falso, una sin pista y dos con pistas distintas. La actividad era de práctica individual, sin efecto en el promedio.
2. Solicitar la pista de la primera pregunta o de una pregunta inexistente devolvió `HINT_UNAVAILABLE`. La proyección estudiantil no contenía las pistas. La lectura previa registró cero consumos.
3. El estudiante respondió la primera pregunta. Desde dos sesiones autenticadas se enviaron simultáneamente solicitudes para las preguntas segunda y tercera.
4. Se repitió la solicitud ganadora y se solicitó de nuevo la otra pista. Se comprobaron la proyección del estudiante y los registros persistidos.
5. Se archivó únicamente la materia creada para la prueba y se cerraron las tres sesiones creadas. Los datos ficticios quedan sujetos al plazo de conservación de treinta días; no se ejecutó mantenimiento global.

## Resultado de la carrera

Ambas solicitudes comenzaron a las 08:18:18,295 UTC. Sus intervalos HTTP se superpusieron.

| Sesión | Pregunta | Duración HTTP | Respuesta | Contenido revelado |
|---|---|---|---|---|
| A | Segunda, la siguiente sin responder | 650,05 ms | HTTP 200 | Su única pista |
| B | Tercera | 644,47 ms | HTTP 400, `QUESTION_ORDER` | Ninguno |

El orden de respuesta HTTP no determina el orden de ejecución o de confirmación de las transacciones. En avance individual sólo la siguiente pregunta sin responder es elegible. Por eso la segunda solicitud puede rechazarse por orden; este ensayo no representa dos preguntas abiertas a la vez.

Repetir la petición ganadora devolvió la misma pista. Pedir después la otra devolvió `HINT_USED`, sin revelar contenido. La auditoría SQL a las 08:22:19 UTC encontró un único consumo en la segunda pregunta. La auditoría posterior, a las 08:23:03 UTC, confirmó ese mismo consumo, ninguno en la tercera y el intento cerrado con motivo `archive`. La clave primaria `(participant_id, kind)` impide guardar dos usos del mismo potenciador para un participante.

## Coordinación y límites

El primer intento de coordinación con una barrera SQL terminó antes de enviar solicitudes por un horario ya vencido. Se conserva ese fallo de preparación. La barrera terminó con `ROLLBACK`, sin modificar el intento y sin observar solicitudes bloqueadas. La ejecución válida utilizó un horario relativo y acreditó superposición HTTP; no acreditó mediante telemetría una espera sobre el bloqueo de PostgreSQL.

AP-12 queda comprobado en el contrato remoto para este escenario: pista inexistente sin consumo, solicitudes de preguntas distintas, un consumo y ausencia de revelación adicional. Se usaron clientes HTTP independientes, no dos pestañas operadas visualmente. No es una medición de capacidad sostenida, una comprobación de todos los intercalados posibles ni evidencia de SMTP o de producción. Las huellas de preparación, ejecución y archivo publicado se distinguen en el JSON; el formato del ejecutor se normalizó después del ensayo.

## Repetición controlada

El ejecutor exige las cuentas ficticias y la configuración local del proyecto. `prepare` rechaza sobrescribir una ejecución existente. Para una nueva ejecución se debe conservar el resultado anterior y preparar rutas nuevas para la evidencia y el estado privado; no borrar consumos para repetir sobre un intento ya utilizado.

```powershell
node tools/datos/hint-concurrency-remote.mjs prepare
node tools/datos/hint-concurrency-remote.mjs race +1000
node tools/datos/hint-concurrency-remote.mjs finish
```

El cierre deja el estado `contract-passed-awaiting-sql-audit` hasta comprobar por separado las filas remotas. Sólo el registro auditado de esta ejecución tiene el estado `passed-remote-contract`.
