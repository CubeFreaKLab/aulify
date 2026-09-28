# Observación de actividad durante ráfagas

Las dos ráfagas del 28 de septiembre confirmaron y conservaron 200 respuestas cada una, pero sus p95 fueron superiores a 1.500 ms. Estos ensayos de doce segundos son diagnósticos y no acreditan Q-06. Se conservan los registros completos, incluidos los defectos del procedimiento de observación.

## Coordinación y relojes

La primera captura SQL cubrió 14:12:36.414–14:12:52.581 UTC, mientras el tráfico medido ocurrió entre 14:13:15.263 y 14:13:27.408 UTC. No hubo solapamiento: la captura no permite extraer conclusiones sobre esperas durante esa ráfaga.

Una [calibración de tres lecturas](datos-relojes-20260928142311.json) comparó el reloj de Windows con `serverTime` del servidor. El intervalo común del desfase servidor menos Windows fue −166 a +95 ms; no explica la separación de más de veintidós segundos. Es una calibración posterior y supone estabilidad de ambos relojes en estas ventanas cercanas.

La segunda captura SQL cubrió 14:28:31.476–14:28:47.977 UTC. Se solaparon con certeza cien de sus 160 muestras con el tráfico de 14:28:29.713–14:28:42.048 UTC, aun considerando el intervalo del desfase. La ráfaga comenzó dos segundos después del inicio del tráfico.

| Ejecución | Pregunta | Confirmadas y auditadas | Ventana de despacho | p95 de confirmación |
|---|---:|---:|---:|---:|
| Primera | 2 | 200, sin pérdidas | 1.889,85 ms | 6.175,94 ms |
| Segunda | 3 | 200, sin pérdidas | 1.879,55 ms | 4.714,51 ms |

En la segunda ejecución hubo 1.298 lecturas de huella, 211 lecturas acotadas y 200 envíos, sin errores técnicos. Los valores corresponden a una ventana breve con instrumentación; no deben compararse como una prueba controlada de mejora con el sondeo de un minuto.

## Hallazgos y defecto del observador

Las muestras de actividad de la segunda ejecución sí variaron. Las lecturas acotadas aparecieron activas sin espera declarada en 59 muestras, con un máximo simultáneo de nueve sesiones y una antigüedad activa máxima observada de 627,90 ms. Los comandos aparecieron en ese estado en 31 muestras, con un máximo de nueve y 241,26 ms. Son muestras repetidas de sesiones, no cantidades de solicitudes únicas; estar activo sin espera declarada no mide directamente consumo de CPU.

En cinco muestras se observaron sesiones clasificadas como `other` esperando `transactionid`, con un máximo de dos simultáneas y antigüedad activa de 32,06 ms. La primera consulta no separaba `COMMIT`; los triggers diferidos pueden ejecutarse durante esa operación. Estos datos no bastan para atribuir las esperas a una relación concreta.

Se detectó además que los bloqueos de `activity_sync_versions` permanecían idénticos en las 160 muestras. La prueba aislada reprodujo la causa: una función que devuelve conjuntos en un nodo `FunctionScan` podía reutilizar su primer conjunto al volver a ejecutarse, aunque `EXPLAIN` mostrara varias iteraciones. El ensayo adquirió un nuevo bloqueo ficticio en cada iteración: la consulta inicial devolvió 1, 1, 1, 1, 1; la variante que evalúa `pg_lock_status()` en la proyección mediante `ProjectSet` devolvió 1, 2, 3, 4, 5. Por ello, **los bloqueos de relación de ambas capturas v1 no son válidos para inferencias**. El resumidor los marca como no disponibles, en lugar de presentar cero como ausencia de contención.

La [consulta v2](../../tools/datos/observe-counter-waits-v2.sql) corrige esa reevaluación, distingue `COMMIT` y agrupa los escritores que mantienen bloqueos en el contador. La [verificación aislada](datos-observador-aislado.json) aprobó la reproducción y la consulta completa de cinco muestras, con su separación temporal y sin exponer identidades ni texto SQL. No cambia funciones, tablas ni datos del proyecto remoto.

## Reproducción y evidencias

```sh
node tools/datos/observation-check.mjs
node tools/datos/summarize-observation.mjs docs/verificacion/datos-observacion-rafaga-20260928142340.json docs/verificacion/datos-observacion-sql-20260928-142829.json docs/verificacion/datos-relojes-20260928142311.json
```

El generador reutiliza cuentas ficticias y cookies guardadas únicamente en el directorio privado. Prepara 204 sesiones, espera una señal local, escalona huellas cada segundo y lee el estado acotado solo cuando cambia la revisión. A los dos segundos distribuye 200 respuestas durante 1,9 segundos; luego audita sus claves de idempotencia. El índice de pregunta es configurable y exige que cada intento conserve exactamente las respuestas anteriores. La consulta SQL solo devuelve agregados y excluye PID, cuentas, direcciones, identificadores de dominio y texto de consultas.

- Primera ejecución: [HTTP](datos-observacion-rafaga-20260928141043.json), [SQL sin solapamiento](datos-observacion-sql-sin-solapamiento.json), [resumen](datos-observacion-rafaga-20260928141043-resumen.json).
- Segunda ejecución: [HTTP](datos-observacion-rafaga-20260928142340.json), [SQL](datos-observacion-sql-20260928-142829.json), [resumen](datos-observacion-rafaga-20260928142340-resumen.json).
- [Generador](../../tools/datos/observe-burst.mjs), [consulta original v1](../../tools/datos/observe-counter-waits.sql), [prueba del observador](../../tools/datos/observation-check.mjs).

PostgreSQL documenta que las estadísticas pueden conservarse en una instantánea de transacción y que `pg_stat_clear_snapshot()` permite descartarla; la consulta lo ejecuta antes de cada muestra. Esto no evita por sí solo la reutilización de un conjunto en el plan de ejecución. Véanse la [documentación de estadísticas](https://www.postgresql.org/docs/17/monitoring-stats.html) y la [vista de bloqueos](https://www.postgresql.org/docs/17/view-pg-locks.html).
