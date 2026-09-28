# Sondeos de lectura y preparación de sesiones

28 de septiembre de 2026. Estos ensayos breves sirven para diagnosticar el transporte; no reemplazan cinco minutos de calentamiento y quince de medición del protocolo Q-06. Las lecturas consecutivas e incondicionales de snapshot generan un patrón diferente al de la aplicación, que primero consulta la huella y descarga contenido solo cuando cambia.

| Registro | Sesiones | Ámbito de snapshot | Concurrencia | Ruta | Solicitudes | Fallos | p95 (ms) |
|---|---:|---|---:|---|---:|---:|---:|
| [2026-09-28T07:50:14.425Z](datos-sondeo-20260928075014.json) | 8 | Espacio completo | 1 | /api/sync | 40 | 0 | 168.19 |
| [2026-09-28T07:50:14.425Z](datos-sondeo-20260928075014.json) | 8 | Espacio completo | 8 | /api/sync | 40 | 0 | 309.39 |
| [2026-09-28T07:50:14.425Z](datos-sondeo-20260928075014.json) | 8 | Espacio completo | 1 | /api/workspace | 40 | 0 | 356.11 |
| [2026-09-28T07:50:14.425Z](datos-sondeo-20260928075014.json) | 8 | Espacio completo | 8 | /api/workspace | 40 | 0 | 628.18 |
| [2026-09-28T08:08:40.529Z](datos-sondeo-20260928080840.json) | 20 | Espacio completo | 1 | /api/sync | 100 | 0 | 170.69 |
| [2026-09-28T08:08:40.529Z](datos-sondeo-20260928080840.json) | 20 | Espacio completo | 8 | /api/sync | 100 | 0 | 286.87 |
| [2026-09-28T08:08:40.529Z](datos-sondeo-20260928080840.json) | 20 | Espacio completo | 20 | /api/sync | 100 | 0 | 573.81 |
| [2026-09-28T08:08:40.529Z](datos-sondeo-20260928080840.json) | 20 | Espacio completo | 1 | /api/workspace | 100 | 0 | 407.05 |
| [2026-09-28T08:08:40.529Z](datos-sondeo-20260928080840.json) | 20 | Espacio completo | 8 | /api/workspace | 100 | 0 | 709.63 |
| [2026-09-28T08:08:40.529Z](datos-sondeo-20260928080840.json) | 20 | Espacio completo | 20 | /api/workspace | 100 | 0 | 1195.72 |
| [2026-09-28T08:44:05.950Z](datos-sondeo-20260928084405.json) | 20 | Actividad | 1 | /api/sync | 100 | 0 | 176.26 |
| [2026-09-28T08:44:05.950Z](datos-sondeo-20260928084405.json) | 20 | Actividad | 8 | /api/sync | 100 | 0 | 221.18 |
| [2026-09-28T08:44:05.950Z](datos-sondeo-20260928084405.json) | 20 | Actividad | 20 | /api/sync | 100 | 0 | 246.70 |
| [2026-09-28T08:44:05.950Z](datos-sondeo-20260928084405.json) | 20 | Actividad | 1 | /api/workspace | 100 | 0 | 485.87 |
| [2026-09-28T08:44:05.950Z](datos-sondeo-20260928084405.json) | 20 | Actividad | 8 | /api/workspace | 100 | 0 | 618.05 |
| [2026-09-28T08:44:05.950Z](datos-sondeo-20260928084405.json) | 20 | Actividad | 20 | /api/workspace | 100 | 0 | 1516.26 |

El primer sondeo coincidió parcialmente con comprobaciones de navegador. Los archivos JSON identifican compilado, revisión, datos observados y latencias por rol. El sondeo con lectura acotada reduce claramente la latencia de la huella en esta muestra; el percentil global del snapshot incluye docentes con cincuenta intentos y no muestra una mejora uniforme.

## Preparación de 204 sesiones

Dos intentos posteriores se detuvieron antes de iniciar lecturas medidas. [El primero conservado](datos-sondeo-20260928084703.json) registra HTTP 401 en la sesión de prueba 50; [el segundo](datos-sondeo-20260928084830.json), en la 92. Una ejecución anterior al primero conservado también se detuvo durante preparación, pero el ejecutor todavía no guardaba el informe de salida por excepción; no se inventa un registro completo de ese intento.

La [consulta agregada de Auth](datos-auth-preparacion.json) observó tres errores 429 en esa ventana. El SDK trataba el rechazo de renovación como definitivo cuando el token de acceso estaba vencido; el proxy ignoraba el error y emitía cookies eliminadas. Es distinto de un fallo de consultas bajo 204 sesiones: la medición todavía no había comenzado. Se corrigió el ejecutor para preservar informes y cookies incluso al fallar la preparación, y espaciar renovaciones a un máximo de una cada 2,5 segundos. La aplicación se corrigió posteriormente: el proxy devuelve 503 con `Retry-After` ante un fallo temporal de Auth y conserva las cookies originales; un refresh inválido definitivo sigue eliminándolas. El comportamiento se comprueba con el SDK SSR real y transporte simulado en [auth-renewal.test.ts](../../tests/unit/auth-renewal.test.ts); no se atribuye esa prueba al servicio remoto.

El límite predeterminado del endpoint de tokens es de 150 solicitudes por cinco minutos, con una ráfaga de hasta treinta. No se elevó esa cuota ni se alteraron direcciones de origen para evitarla. [Documentación de Supabase Auth](https://supabase.com/docs/guides/auth/rate-limits).

Quedaban pendientes el sondeo de 204 lectores y la ráfaga breve de respuestas; el resultado posterior del primero se registra a continuación. Una nueva ejecución completa de Q-06 depende de que los sondeos justifiquen continuar. Los dos ensayos anteriores de Q-06 permanecen conservados como resultados no aprobados.

## Sondeo de 204 lectores después de la corrección Auth

La ejecución del 28 de septiembre entre 08:57:14 y 09:02:09 UTC preparó las 204 sesiones, con 101 renovaciones espaciadas y sin errores en esta repetición. El compilado fue `7sRhvomkfVIG0kD7-y2WS`. Se conservó el historial ficticio anterior; cada lector consultó el ámbito de su actividad.

| Ruta | Concurrencia | Solicitudes | Fallos | p95 (ms) |
|---|---:|---:|---:|---:|
| /api/sync | 20 | 408 | 0 | 383.10 |
| /api/sync | 204 | 408 | 0 | 2701.07 |
| /api/workspace | 20 | 408 | 0 | 406.56 |
| /api/workspace | 204 | 408 | 0 | 7760.41 |

[Registro completo](datos-sondeo-20260928085714.json). Se observaron 24,58 MB de cuerpos HTTP incluyendo preparación; estimación preventiva de 51,05 MB. La eliminación de fallos de preparación no demuestra capacidad: a concurrencia 204 las latencias todavía superan los objetivos del producto. Este sondeo dispara lecturas incondicionales en ráfagas, de modo que no mide la propagación de una sesión guiada ni reproduce exactamente el sondeo escalonado de la aplicación. Se requiere medir el protocolo real para atribuir un resultado a Q-06.

## Sondeo breve de respuestas

El 28 de septiembre, entre 2026-09-28T12:28:31.878Z y 2026-09-28T12:29:38.265Z, se prepararon 24 sesiones con renovaciones espaciadas a 2,5 segundos (cuatro docentes y veinte estudiantes, cinco por materia). No hubo esperas por límite de Auth. Se crearon actividades ficticias nuevas y se envió una respuesta por estudiante. Compilado `7sRhvomkfVIG0kD7-y2WS`.

Se confirmaron y recuperaron mediante lectura posterior las veinte respuestas, sin claves ausentes o modificadas. La ráfaga se distribuyó en 1795.59 ms y el p95 de confirmación fue 665.58 ms. Las veinte solicitudes de respuesta terminaron con HTTP 200. [Registro completo](datos-sondeo-respuestas-20260928122831.json).

Este resultado comprueba la contención de una ráfaga pequeña después de introducir los contadores de revisión; no incluye doscientos estudiantes, diez preguntas, sondeo paralelo ni la duración requerida por Q-06. La integridad observada en veinte respuestas no se extrapola a una carga mayor. Antes de otro ensayo sostenido se debe revisar el comportamiento del protocolo escalonado con la concurrencia completa y conservar los límites de consumo.

El diagnóstico posterior del protocolo escalonado con 204 sesiones y ráfaga de 200 respuestas está en [el informe de un minuto](datos-protocolo-60s.md). No aprobó la latencia de confirmación; conserva la integridad de las respuestas observadas.
