# Clasificación de fallos del servicio en comandos

Verificación local del 29 de septiembre de 2026. Un fallo de transporte o del servicio ya no se transforma de forma general en HTTP 400. La ruta devuelve HTTP 503 con `Retry-After: 30` cuando no puede confirmar el cambio, y pide comprobar su estado antes de volver a actuar. No reenvía el comando ni modifica su clave de idempotencia.

La clasificación conserva HTTP 400 y los mensajes de negocio para `P0001`, HTTP 403 para `42501`, HTTP 401 para una credencial rechazada y HTTP 429 para el límite de negocio. Los errores internos no reconocidos se presentan como HTTP 500. Fallos de conexión, serialización, interbloqueo, espera de conexión o cancelación SQL se distinguen mediante categorías internas y responden 503; la cancelación `57014` no se describe como un timeout demostrado.

La ruta registra únicamente una categoría cerrada y la duración del RPC en milisegundos. Esa duración incluye el transporte y la ejecución del SDK; **no es tiempo SQL**. No registra contenido, argumentos, claves de idempotencia, identidad, JWT, cookies, consultas ni mensajes o detalles del error. No instrumenta la validación de identidad ni cambia su tratamiento. No se añadió `Server-Timing`.

## Verificación

- `npx vitest run tests/unit/commands-rpc-failure.test.ts tests/unit/http.test.ts`: 25 pruebas aprobadas.
- `npx eslint src/lib/rpc-failure.ts src/app/api/commands/route.ts tests/unit/commands-rpc-failure.test.ts`: sin errores.
- `npx tsc --noEmit --incremental false`: sin errores.

Los casos cubren indisponibilidad RPC, restricciones y permisos, JSON inválido, sesión inválida antes de ejecutar, ACK válido y conservación de argumentos, límite de negocio y excepciones inesperadas. Incluyen el SDK Supabase instalado con transporte simulado: un timeout de conexión produce una sola solicitud POST, categoría de timeout y respuesta 503 sin filtrar el error. También distinguen `TypeError('fetch failed')` de un `TypeError` de programación. Las pruebas comprueban que texto privado de ejemplo no aparece en respuestas ni registros.

La verificación es local. No se compiló ni reinició el servidor de producción, no se repitió la carga remota y no se atribuyen retrospectivamente los siete HTTP 400 del sondeo a una causa específica. Q-06 continúa pendiente.

## Referencias y código

Se consultaron las guías de Route Handlers y Error Handling incluidas en Next.js 16.3.6, la implementación local de `PostgrestBuilder` y la [documentación oficial de códigos PostgREST de Supabase](https://supabase.com/docs/guides/api/rest/postgrest-error-codes). El SDK convierte fallos de `fetch` en resultados con estado 0 y código vacío; los detalles pueden contener la causa, pero no se publican ni se guardan.

[Ruta](../../src/app/api/commands/route.ts) · [Clasificación](../../src/lib/rpc-failure.ts) · [Pruebas](../../tests/unit/commands-rpc-failure.test.ts) · [Sondeo previo](datos-protocolo-60s-migracion16.md).
