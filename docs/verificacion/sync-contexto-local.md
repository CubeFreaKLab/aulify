# Consolidación local de lecturas de sincronización

Verificación: 30 de septiembre de 2026. La candidata se creó con `supabase migration new` y se comparó localmente antes de aplicarla. La integración remota se describe al final.

## Evidencia y alcance

El [sondeo con dieciocho migraciones](datos-protocolo-60s-migracion18.md) confirmó y conservó 200 respuestas, sin errores técnicos, pero su p95 de confirmación fue 3.226,12 ms. Q-06 continúa pendiente. Los [agregados del servicio](datos-protocolo-migracion18-servicio.json) no son tiempos SQL ni permiten localizar por sí solos la espera.

Los tiempos medios de ejecución SQL deben distinguirse de los percentiles HTTP y no permiten atribuir por sí solos la espera a esta función. La candidata no se presenta como solución verificada del retraso de confirmación.

La revisión del cuerpo de `app.activity_sync` encontró lecturas puntuales separadas y trabajo no utilizado en la rama docente. Se preparó únicamente esta reducción local, sin modificar `activity_snapshot`, autenticación, índices, tablas, plazos o umbrales.

## Cambio

La migración es `supabase/migrations/20260930005228_aulify_sync_context_reads.sql`, con SHA-256:

```text
9f902396491da6a509dd3268dfcd2c8ae66296b1eb5eae5353e3008bfa1947c9
```

- Actividad, materia, revisión común y configuración se obtienen mediante una consulta. Los `LEFT JOIN` mantienen las ausencias y los valores nulos de los metadatos opcionales; las claves de unión son únicas.
- El alumno obtiene participante y revisión propia conjuntamente.
- El docente omite la búsqueda del participante propio y su contador estudiantil, que no intervienen en su resultado.
- Se mantienen el requisito de usuario confirmado y perfil, la comprobación actual de matrícula, el acceso del propietario, el agregado docente ordenado por identidad, las ampliaciones de plazo y la composición del digest.

Sin duración individual, los `SELECT` principales del cuerpo pasan de siete a tres para un alumno y de ocho a tres para el docente. Este recuento excluye las consultas internas de `require_user` y el `EXISTS` de autorización, que permanecen; tampoco expresa una mejora porcentual de latencia. Con duración individual se conserva la consulta adicional de intentos y ampliaciones personales. El agregado docente continúa recorriendo los participantes de una actividad.

No se introducen escrituras ni bloqueos de fila. Se conservan las ACL y `search_path` de las funciones existentes.

## Verificación local

```text
node tools/datos/sync-context-check.mjs
```

Resultado final: **97 comprobaciones aprobadas**, proceso de aproximadamente 2,53 segundos. El [registro reproducible](datos-sync-contexto-local.json) incluye los hashes del script, la función base y la migración candidata.

El script crea una base PGlite aislada con las dieciocho migraciones anteriores, conserva una copia de la función vigente y compara ambas funciones sobre el mismo estado dentro de la misma transacción. Compara el JSON completo salvo `serverTime`, que usa `clock_timestamp` y por definición cambia entre llamadas; ese campo se verifica como fecha válida y no decreciente. `revision` y `nextDeadline` deben coincidir exactamente. También se comparan códigos y mensajes de rechazo.

Los casos incluyen ambos roles, propietario que también figura como participante, alumno sin participante, materia archivada o en purga, quiz sin publicar, actividad inexistente o de otro tipo, usuario ajeno, matrícula retirada, correo sin confirmar, perfil ausente y acceso anónimo. Se comprueban contadores y ajustes ausentes, plazos nulos, apertura y cierre en el instante exacto, vencimiento, duración individual, ampliaciones comunes y personales y ausencia de intentos abiertos.

Se verificaron además las huellas tras respuestas, reintentos idempotentes, revisión privada, publicación de nota, incorporación, eliminación y reinserción de participantes. La revisión privada conserva la huella del alumno y la publicación afecta solo al destinatario correspondiente.

## Límite

La evidencia local prueba equivalencia funcional y reducción del número de sentencias principales; no demuestra reducción de tiempo en producción. PGlite no reproduce espera del pool, red, concurrencia, recursos del plan remoto ni todos los intercalados de transacciones concurrentes. Esta comprobación no ejecutó carga, compilación, reinicio ni despliegue.

## Integración remota posterior

Después de revisar la candidata se aplicó al proyecto de Aulify. Supabase asignó el identificador `20260930005228`; el archivo local se renombró desde `20260930004340`, conservando exactamente los bytes y el SHA-256. Se repitieron las 97 comprobaciones locales con el nombre definitivo y una base explícita de dieciocho migraciones, sin incluir otras candidatas.

La [comparación remota](datos-contexto-sync-remoto.json) obtuvo las mismas huellas y el mismo plazo antes y después para un estudiante y el docente de una actividad ficticia con cincuenta participantes. Se excluyó únicamente `serverTime`. El asesor conserva los 41 avisos informativos de RLS sin políticas del esquema privado y el aviso conocido de protección de contraseñas filtradas, disponible en Pro; se mantiene el plan Free. No se ampliaron permisos ni se modificaron datos de negocio.

La integración no acredita Q-06. El [diagnóstico de costes](coste-rpc-20260930.md) distingue los tiempos de ejecución SQL de la espera HTTP.
