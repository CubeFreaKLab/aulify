# Espera del transporte durante una ráfaga

La medición instrumentada del 30 de septiembre de 2026 conservó las doscientas respuestas confirmadas, pero no cumplió Q-06: la confirmación tuvo p95 de **5.096,83 ms**, frente a la meta de 1.500 ms. No se aprueba capacidad ni se modifica el criterio de liberación.

## Entorno y método

Aplicación `1e4160b`, compilado `LxncBY74HOrDyZhjUMIuv`, en Windows local; Supabase Free remoto. Entre 07:19:14 y 07:20:14 UTC participaron 204 sesiones HTTP. Se enviaron 200 respuestas en 1.891,21 ms. Se completaron 10.634 solicitudes de la fase sin fallos técnicos; la auditoría encontró 200 respuestas y ninguna confirmada faltante o modificada. El consumo adicional estimado, incluida preparación y auditoría, fue 68.605.480 bytes.

El instrumento observó llamadas al dispatcher y sus eventos de conexión, cabeceras y finalización, sin registrar cuerpos, credenciales ni identidades. Se verificó primero con dos solicitudes HTTP locales y una conexión retenida. El registro de aplicación, los agregados y las huellas de los archivos privados se conservan en el [resumen JSON](diagnostico-despacho-20260930.json) y en el [reporte del ejecutor](datos-protocolo-60s-20260930071801.json).

## Hallazgos

| Medida                                         |            Resultado | Interpretación                                                  |
| ---------------------------------------------- | -------------------: | --------------------------------------------------------------- |
| Espera hasta conexión disponible, p95          |          3.992,19 ms | Incluye cola y establecimiento de conexión.                     |
| Desde conexión disponible hasta cabeceras, p95 |          3.293,85 ms | Incluye transporte y servicio remoto; no equivale a tiempo SQL. |
| Mayor cola de comandos observada               |       89 solicitudes | Las 32 conexiones reservadas también llegaron a ocuparse.       |
| Mayor cola de lectura observada                |      108 solicitudes | Las 96 conexiones de lectura llegaron a ocuparse.               |
| Despachos por respuesta                        | Uno en los 200 casos | No se observó reenvío automático de esos comandos.              |

Los percentiles de las etapas no se suman: pueden corresponder a solicitudes distintas. El muestreo de los pools ocurrió cada 250 ms. El instrumento modifica el entorno; la diferencia frente al ensayo sin instrumentar no demuestra por sí sola una regresión causada por el transporte.

Entre las dos lecturas de `pg_stat_statements`, hubo 10.021 consultas de sincronización con media de ejecución SQL de 1,02 ms; 404 comandos con media de 37,56 ms y 430 proyecciones con media de 130,96 ms. La ventana también incluye preparación y auditoría. Estos promedios no aíslan la espera de la pasarela, adquisición de conexión, red o confirmación de transacción y no son percentiles de respuesta HTTP. La planificación no estaba cuantificada por este registro. Una muestra de sesiones posterior a la ráfaga no permite descartar contención durante ella.

## Consecuencia para la siguiente verificación

La reserva protege a los comandos de ocupar la misma cola de lecturas, pero no basta para acreditar la capacidad. El diagnóstico identifica espera en ambos pools y también después del despacho. No justifica atribuir todo el retraso a PostgreSQL ni cambiar índices o aumentar conexiones sin comprobar el efecto.

`vercel.json` ya configura `gru1`; el panel Resources de la vista previa `27e4df6` confirmó esa región y Node.js 24.x para los endpoints observados. Debe distinguirse esa topología de la aplicación ejecutada en la PC. La siguiente comprobación del alojamiento requiere el candidato actualizado y acceso autorizado del ejecutor a la vista previa protegida. No se han desactivado sus protecciones ni publicado producción para eludir esta comprobación.
