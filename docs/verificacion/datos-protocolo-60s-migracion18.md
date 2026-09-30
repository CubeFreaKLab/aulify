# Diagnóstico con consultas acotadas e instrumentación

El 30 de septiembre de 2026 se midió el build `NJgfZnpvHJ7YBpHn4hEBZ`, con dieciocho migraciones locales/remotas. La fuente del ejecutor y las rutas instrumentadas queda identificada mediante hashes en el [registro](datos-protocolo-60s-20260930002229.json). El cambio posterior de renovación Auth no forma parte de este build.

La preparación utilizó las 204 identidades ficticias existentes y los jars conservados. Terminó sin esperas por error. El [intento anterior](preparacion-carga-20260930.md), que se detuvo antes de medir, se mantiene separado.

## Resultado observado

La ventana comenzó a las **00:27:40,339 UTC** y terminó de drenar sus solicitudes a las **00:28:42,011 UTC**: 60 segundos de generación y 1,67 segundos adicionales de finalización. Hubo cuatro docentes y 200 estudiantes, distribuidos en cuatro actividades de avance individual.

| Medida | Resultado |
|---|---:|
| Respuestas enviadas | 200 en 1.889,77 ms |
| Respuestas confirmadas | 200 |
| Respuestas persistidas, comprobadas después | 200 |
| Confirmaciones perdidas o modificadas | 0 |
| p95 de confirmación | **3.226,12 ms** |
| Solicitudes medidas | 9.974 |
| Fallos técnicos | 0 |
| Sincronización | 9.361 solicitudes; p95 2.404,40 ms |
| Snapshot acotado | 413 solicitudes; p95 3.960,76 ms |
| Retardo p95 del bucle del generador | 32,39 ms |

Se recibieron 16.773.420 bytes contando preparación, medición y auditoría. La estimación conservadora del ejecutor fue 44.182.104 bytes; no sustituye el contador facturable del proveedor. La [cuota observada antes](cuotas-supabase-20260929.md) dejaba margen para este sondeo y no se activó un plan de pago.

## Interpretación y límites

Las 200 respuestas se conservaron y no hubo errores técnicos en esta ventana. **Q-06 sigue sin aprobar**: 3.226,12 ms supera el máximo de 1.500 ms. Tampoco se ejecutaron aquí los cinco minutos de calentamiento y quince de medición de cada modalidad, diez respuestas por estudiante ni propagación guiada. El resultado no equivale a una evaluación de 204 navegadores, a un despliegue alojado ni a Q-09 completo.

El sondeo anterior de migración 16 confirmó 193 respuestas y presentó errores. La diferencia describe las ejecuciones; no identifica una causa única ni permite atribuir todo el cambio a la consulta docente. Se conserva el umbral original.

La [consulta agregada de registros del servicio](datos-protocolo-migracion18-servicio.json) recuperó 200 comandos HTTP 200 en la ventana, con `origin_time` p95 de 3.203 unidades del proveedor. Se conserva el campo sin confundirlo con tiempo SQL: la referencia oficial consultada identifica su tipo numérico, pero no especifica allí su unidad. El análisis aún debe separar ejecución y espera de servicio/pool antes de elegir otra corrección. El registro local no conserva tiempos individuales de inicio y fin; su orden de inserción refleja finalización, por lo que no permite reconstruir fases temporales exactas de cada solicitud.
