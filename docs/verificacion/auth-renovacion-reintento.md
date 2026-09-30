# Renovación recuperada después de un fallo transitorio

Verificación local: 30 de septiembre de 2026, 00:24–00:26 UTC.

## Problema y corrección

El cliente SSR instalado puede reintentar la renovación cuando Auth responde 503. El marcador local de indisponibilidad conservaba aquel primer fallo aunque el reintento devolviera una sesión válida. Como consecuencia, el proxy respondía 503 y su manejador de cookies omitía la rotación que acababa de obtener. El mismo marcador impedía eliminar las cookies si el segundo intento rechazaba definitivamente el refresh token.

`src/lib/supabase/auth-availability.ts` conserva ahora los fallos pendientes por operación, identificada por método y URL. Una respuesta definitiva de esa operación retira su marcador: el SDK puede guardar una renovación válida o eliminar una sesión rechazada. Un éxito de otra operación, otro endpoint u otro origen no elimina el fallo pendiente.

Se mantienen la comprobación de identidad mediante `getClaims`, el tratamiento de indisponibilidad persistente y los límites de permisos existentes. El cambio no añade reintentos, no modifica los RPC, no registra cookies ni tokens y no acepta una identidad a partir de la mera decodificación del JWT.

## Reproducción y pruebas

Se utilizó `@supabase/ssr` 0.12.7 y `@supabase/supabase-js` 2.117.2 reales, con el transporte sustituido por respuestas simuladas. No hubo solicitudes a Supabase ni a un servidor HTTP local durante estas pruebas.

Antes de corregir el helper, los dos casos nuevos reprodujeron el defecto: la secuencia 503 → renovación válida terminaba en 503, y 503 → refresh inválido conservaba `Retry-After: 30` en vez de permitir eliminar la cookie. Los otros tres casos SSR existentes pasaron.

Después de la corrección se ejecutó:

```text
npx vitest run tests/unit/auth-availability.test.ts tests/unit/auth-renewal.test.ts tests/unit/http.test.ts --maxWorkers=1
```

Resultado: **14 pruebas aprobadas en 3 archivos; duración informada por Vitest: 1,36 s**. Cubren:

- 503 seguido de renovación válida, persistencia de la cookie y verificación posterior de identidad.
- 503 seguido de rechazo definitivo del refresh token y eliminación de la cookie.
- Renovación seguida de un JWT rechazado por el endpoint de identidad: no se obtienen claims y se conserva la respuesta 401.
- 429 persistente: respuesta 503, `Retry-After` y conservación de las cookies, sin permitir continuar hacia los datos.
- Éxitos en REST, `/user`, JWKS, otro tipo de grant, otro método u otro origen que no resuelven un fallo de renovación pendiente.
- Recuperación de un fallo de transporte y conservación de otros fallos Auth pendientes.
- Casos existentes de respuestas HTTP, origen y validación de entrada.

Prettier se ejecutó únicamente sobre los tres archivos modificados de código y pruebas. No se ejecutaron compilación, reinicio, carga ni verificaciones remotas. El lint y la comprobación general corresponden a la integración posterior.

## Alcance de la evidencia

Esta es una corrección reproducida de forma aislada. No demuestra que el marcador latente causara la interrupción previa de la preparación a los 15 segundos, y no verifica el requisito de capacidad Q-06. La medición posterior conservó el build anterior `NJgfZnpvHJ7YBpHn4hEBZ`, sin este cambio.

Después del sondeo se integró la corrección en el commit `c5db1cc`. La compilación `NZlgLN2ir82OxW0NAxSk9` terminó correctamente y la batería local aprobó 141 pruebas en quince archivos. El lint focalizado también pasó. Estos resultados amplían la comprobación aislada; no simulan un fallo real del proveedor ni sustituyen la verificación posterior en CI.
