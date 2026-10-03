# Diagnóstico de capacidad en Vercel

El 2 de octubre de 2026 se ejecutó un diagnóstico de sesenta segundos sobre una Preview protegida de Vercel, con Supabase Free remoto. Conservó las 200 respuestas confirmadas, pero no cumplió la latencia ni el porcentaje de fallos previstos. No aprueba Q-06, Q-09 ni AP-35.

## Entorno y procedimiento

- Código de aplicación: `4fa2c2dda6130f3d7e26c37e91272cd8f0c4279b`; build de Preview `SHNr3KV_ObMUeLZyciI1U`, región `gru1`. Los cambios posteriores hasta `397cad1` son SQL, pruebas, herramientas y documentación. Se comprobó que no había cambios de aplicación respecto del código desplegado.
- Cuatro docentes y 200 estudiantes ficticios, repartidos en cuatro materias. Sesiones independientes. Supabase mantiene las 25 migraciones aplicadas.
- Sondeo escalonado cada segundo; una consulta de proyección sólo cuando cambia la huella. Los reintentos de lectura tienen espera creciente. El generador espera solicitudes en curso antes del cierre.
- Una pregunta cerrada por estudiante en ritmo individual. Despacho de las 200 respuestas en 1.884 ms. Auditoría posterior por docente, fuera de la medición.
- Inicio de medición: `2026-10-03T00:51:24.771Z`, equivalente al 2 de octubre a las 20:51:24 en America/La_Paz. El cierre, incluidas solicitudes en curso, duró 62.465 ms.

Se comprobó el estado Ready/Preview y la correspondencia de código y build. El acceso del ejecutor utilizó un secreto temporal fuera de Git, sin desactivar la protección general.

Al finalizar se retiró el secreto del panel y se comprobó que la misma clave ya recibía la redirección de protección HTTP 302. Se eliminó su copia local. El [registro de revocación](acceso-preview-temporal.json) distingue la variable antigua que permanece dentro del despliegue hasta una reconstrucción del acceso que ya fue revocado.

## Resultado observado

| Operación                | Solicitudes | Fallos |     p95 HTTP |
| ------------------------ | ----------: | -----: | -----------: |
| Sincronización           |       2.055 |     36 |  9.273,33 ms |
| Proyección de actividad  |         376 |     30 | 12.225,03 ms |
| Respuesta del estudiante |         200 |      0 | 11.165,38 ms |

Las 200 respuestas tuvieron confirmación y permanecían en la base con sus claves originales: cero confirmaciones perdidas o sustituidas. El p95 de confirmación fue 11.165,44 ms, superior a la meta de 1.500 ms. Hubo 66 fallos temporales de lectura entre 2.631 solicitudes medidas, un 2,51 %. Todos quedaron clasificados como `transport_timeout`; no se deduce de esa categoría que PostgreSQL fuera el único origen del retraso.

La cabecera de tiempos separa preparación, llamada RPC y codificación. En las respuestas del estudiante, el p95 de preparación fue 4,33 ms y el de la llamada RPC 10.627,91 ms. RPC incluye espera del transporte, servicio y lectura de la respuesta; no equivale a tiempo SQL puro. El generador registró 32,18 ms de p95 de demora de su bucle de eventos. Las estadísticas SQL acumuladas consultadas después incluyen ejecuciones históricas y no permiten atribuir esas demoras a esta ventana.

## Cuotas y decisión

El panel de Supabase mostraba el 2 de octubre por la noche un consumo de 1,013/5 GB de transferencia, 0,071/0,5 GB de base y 211/50.000 usuarios activos mensuales; indicaba que no se había superado una cuota vigente. La estimación conservadora adicional del ejecutor fue 56.898.020 bytes y no es el contador facturable. El panel puede actualizarse con retraso, por lo que esta lectura tampoco cierra Q-09 conjunto con Vercel.

No se inició otra prueba de cuarenta minutos: el diagnóstico no justifica repetirla sin corregir primero la acumulación de espera. Los umbrales del requisito se mantienen. La integridad observada acredita este caso; no acredita capacidad sostenida, propagación guiada, render de 204 navegadores o liberación de producción.

Informe completo: [datos-protocolo-60s-20261003004230.json](datos-protocolo-60s-20261003004230.json). Ejecutor: [load-protocol.mjs](../../tools/datos/load-protocol.mjs). Debe resolverse una hipótesis específica de la espera RPC y comprobarse con una medición acotada antes de reintentar Q-06.
