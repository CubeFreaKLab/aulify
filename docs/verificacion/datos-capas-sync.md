# Comparación de sincronización por capas

28 de septiembre de 2026. Sondeo breve de la misma RPC `aulify_sync` con las mismas identidades: llamada REST directa a Supabase frente a `/api/sync` de la aplicación local. Los JWT existentes permanecían válidos; no hubo renovación durante la medición. Se alternó el orden de capas entre niveles de concurrencia.

Compilado `7sRhvomkfVIG0kD7-y2WS`. Cien sesiones ficticias, doscientas llamadas por combinación y dos lecturas iniciales fuera de las muestras principales.

| Camino | Concurrencia | Solicitudes | Fallos | p50 (ms) | p95 (ms) |
|---|---:|---:|---:|---:|---:|
| HTTP Aulify | 20 | 200 | 0 | 172.77 | 771.47 |
| REST/RPC Supabase | 20 | 200 | 0 | 169.40 | 782.71 |
| REST/RPC Supabase | 100 | 200 | 0 | 224.58 | 1187.41 |
| HTTP Aulify | 100 | 200 | 0 | 661.36 | 1345.11 |

La latencia aparece también en la llamada directa, especialmente al aumentar concurrencia. Esta muestra no demuestra que el proxy o la validación JWT sean el cuello de botella principal. La diferencia entre rutas incluye variabilidad temporal y de red; no se presenta la resta de percentiles como tiempo exacto del servidor.

La llamada directa conserva autenticación y los mismos permisos SQL: no utiliza la clave administrativa. Incluye red, PostgREST y PostgreSQL, por lo que tampoco permite atribuir toda la latencia al motor SQL. Para localizar la espera hacen falta métricas del servidor/base o un plan de consulta medido con el mismo escenario. No hay modificaciones del esquema ni del código entre los cuatro tramos.

[Registro completo](datos-capas-sync-20260928124639.json) · [Ejecutor](../../tools/datos/load-layers.mjs) · [Diagnóstico con respuestas](datos-protocolo-60s.md).

Este sondeo no acredita Q-06. La evidencia de capacidad continúa señalando p95 de confirmación superior al objetivo; se preservan esos resultados y los cortes anteriores.
