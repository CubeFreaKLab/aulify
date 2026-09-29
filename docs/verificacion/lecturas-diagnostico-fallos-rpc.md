# Diagnóstico seguro de fallos en lecturas

Verificación local del 29 de septiembre de 2026. Las rutas de huella, lectura acotada de actividad y lectura general del aula utilizan la misma clasificación de fallos RPC que los comandos. Conservan HTTP 403 cuando el servicio deniega acceso y no modifican sus consultas, argumentos ni respuestas satisfactorias.

La medición de duración comienza después de validar la identidad y termina al recibir el resultado o excepción de la llamada RPC. El registro identifica el ámbito cerrado `sync` o `workspace`, una categoría y milisegundos. No registra cuerpos, argumentos, estudiantes, consultas, códigos SQL, mensajes del servicio, cookies ni JWT. El ámbito `command` sigue siendo el predeterminado; la ruta de comandos no cambió en esta unidad.

Los fallos RPC de lectura incluyen `X-Aulify-Rpc-Failure` con una categoría enumerada. Las respuestas 503 incluyen `Retry-After: 30`. Una indisponibilidad previa de identidad mantiene su tratamiento original, sin cabecera RPC ni registro de duración RPC. Una cabecera ausente significa «sin clasificación RPC disponible»; por sí sola no demuestra un fallo de Auth.

## Verificación aislada

- `npx vitest run tests/unit/read-rpc-failure.test.ts tests/unit/commands-rpc-failure.test.ts tests/unit/http.test.ts`: **58 pruebas aprobadas**; 33 corresponden a lecturas.
- `node --test tools/datos/load-failure-category.test.mjs tools/datos/load-waits.test.mjs`: **5 pruebas aprobadas**.
- `npx eslint` sobre las dos rutas, el clasificador y la prueba nueva: sin errores.
- `npx tsc --noEmit --incremental false`: sin errores.
- `node --check tools/datos/load-protocol.mjs` y comprobación del diff: sin errores.

Se probaron permisos, validación del identificador antes de consultar, indisponibilidad de identidad sin RPC, conservación de consultas y respuestas, excepciones de transporte y exclusión del tiempo de Auth. El SDK real, con transporte simulado, generó un timeout de conexión: cada recorrido emitió una sola solicitud POST y registró únicamente la categoría y duración. Las pruebas comprueban que texto privado de ejemplo no aparece en respuesta ni registros. Se preservaron las pruebas de comandos.

## Ejecutor preparado, sin nueva medición

El ejecutor de un minuto captura la cabecera mediante una lista cerrada. Valores desconocidos o ausentes se convierten en `unclassified`; tampoco conserva nombres o mensajes arbitrarios de excepciones del generador. El informe agrupa cantidad y p95 HTTP por operación y categoría. Mantiene los registros históricos y las guardas existentes de proyecto y build, y añade hashes de las fuentes de instrumentación. Esos hashes describen archivos locales; no demuestran por sí solos que el servidor esté compilado con ellos.

El ámbito de comandos conserva su registro del servidor, pero todavía no emite esta cabecera. Por eso el ejecutor no asignará automáticamente una causa a sus fallos. El p95 HTTP del ejecutor tampoco equivale al tiempo SQL ni al tiempo RPC registrado dentro de la ruta.

No hubo carga remota, compilación, reinicio, nuevas cuentas ni migraciones. El build existente `Uh-fjoiC7EsPHOpmME_0K` se conservó; **esta instrumentación aún no está verificada en ese servidor**. No se reinterpreta el sondeo anterior ni se declara Q-06 aprobado.

## Condiciones para el siguiente sondeo

1. Integrar esta unidad y registrar commit y hashes; revisar la correspondencia entre fuentes, migraciones locales y esquema remoto.
2. Compilar esa revisión y verificar el nuevo identificador tanto en disco como en HTML servido. No medir sobre el build previo.
3. Revisar el consumo actual del proyecto gratuito y dejar constancia del margen disponible; la estimación histórica de bytes no sustituye la cuota actual. Mantener los cortes de seguridad y la autorización para una única ventana.
4. Ejecutar solo entonces el mismo escenario corto: cuatro docentes y doscientos estudiantes ficticios existentes, 60 segundos, sondeo escalonado y una ráfaga de 200 respuestas. Mantener usuarios, umbrales, autenticación previa y reglas de reintento; guardar un informe separado.
5. Comparar latencias y categorías del cliente con duraciones RPC del servidor. `transport_timeout` localiza una espera en transporte; `database_timeout`, `database_cancelled` y `transaction_contention` distinguen situaciones del servicio. No atribuir una causa a `unclassified`, ni repetir el ensayo automáticamente.

La próxima ejecución necesita comprobar esas condiciones. Esta preparación no inicia mediciones ni modifica los criterios de Q-06.

[Clasificador](../../src/lib/rpc-failure.ts) · [Pruebas de lectura](../../tests/unit/read-rpc-failure.test.ts) · [Filtro del ejecutor](../../tools/datos/load-failure-category.mjs) · [Ejecutor](../../tools/datos/load-protocol.mjs) · [Sondeo anterior](datos-protocolo-60s-migracion16.md).
