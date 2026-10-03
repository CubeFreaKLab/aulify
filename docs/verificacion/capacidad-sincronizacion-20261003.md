# Confirmación de respuestas y diagnóstico de capacidad

El ajuste de sincronización redujo el trabajo repetido después de confirmar una respuesta. El diagnóstico corto del 3 de octubre confirmó y conservó las 200 respuestas con un p95 de **1.236,09 ms**, dentro de los 1.500 ms previstos. No registró fallos técnicos. La [medición larga posterior](capacidad-200-20261003.md) mostró demoras que ese diagnóstico no detectó: Q-06, Q-09 y AP-35 siguen sin aprobar.

## Qué se corrigió

La respuesta del servidor ya contiene el intento actualizado. Descargarlo de nuevo porque cambió su revisión añadía una lectura completa por estudiante. El cliente ahora puede aceptar esa revisión cuando conoce su base y el servidor confirma que el intento incluye todos los cambios individuales producidos por el envío. La comprobación conserva las lecturas si hubo un cambio común del docente, una base desconocida, un plazo o recuperación tras un fallo. Mientras envía una respuesta, ese cliente suspende su sondeo; los otros participantes continúan consultando.

Las migraciones 26 y 27 conservan puntuación, permisos e idempotencia. No cambian entidades ni aumentan las cuotas del plan. Diecisiete pruebas del almacén comprobaron confirmación, descarte de lecturas antiguas, cambios externos y recuperación. Ocho comprobaciones SQL aisladas verificaron revisiones, permisos y respuestas; un cambio común dentro de la transacción se simuló con un disparador de prueba. Esa simulación no equivale a concurrencia entre conexiones. El [ensayo remoto de reintento](revision-ack-remota.json) contrastó la base y la revisión con PostgreSQL alojado, sin añadir otra respuesta.

## Mediciones conservadas

Las tres ejecuciones usaron la aplicación compilada local y Supabase Free alojado, cuatro docentes y 200 estudiantes ficticios, con sondeo cada segundo. Mantienen la ráfaga de 200 envíos en menos de dos segundos y los mismos umbrales.

| Diagnóstico                                                                  | Confirmación p95 | Fallos técnicos | Respuestas confirmadas y persistidas | Interpretación                                                                    |
| ---------------------------------------------------------------------------- | ---------------: | --------------: | -----------------------------------: | --------------------------------------------------------------------------------- |
| [Antes del ajuste](datos-protocolo-60s-20261003140509.json)                  |      3.314,42 ms |               0 |                                  200 | Supera el límite de confirmación.                                                 |
| [Primera revisión](datos-protocolo-60s-20261003143132.json)                  |      8.405,38 ms |             200 |                                  200 | Empeoró; se conservaron los fallos y se corrigió la omisión de lecturas externas. |
| [Con base y proyección comprobadas](datos-protocolo-60s-20261003151449.json) |      1.236,09 ms |               0 |                                  200 | Cumple el límite en este diagnóstico corto.                                       |

La última ejecución utilizó el build local `Q8X9tTMoeF3--ijLW3OwY`, con el cambio de aplicación `2fb31d2` y las 27 migraciones remotas. La preparación y la auditoría quedan fuera de los sesenta segundos. La ráfaga se distribuyó en 1.862,91 ms. Las 11.053 consultas ligeras y las 209 descargas de proyección no fallaron; su p95 fue 904,79 ms y 3.334,56 ms, respectivamente. El tiempo de RPC incluye transporte y servicio; no se presenta como tiempo SQL puro.

El ejecutor simula el protocolo HTTP y la aplicación conserva sus controles de autorización. No ejecuta 204 navegadores, no mide dibujo de pantalla y no acredita el rendimiento de Vercel. La publicación, el correo y la comprobación conjunta de cuotas mantienen su evidencia separada. La prueba completa requiere cinco minutos de calentamiento y quince de medición en cada modo, con diez preguntas, auditoría de integridad y lectura de notas publicadas.

## Lecturas agrupadas y ensayo sostenido

La migración 28 conservó el orden de autorización de la operación original para membresías retiradas, materias archivadas y propietarios ajenos. La migración 29 permite al servidor agrupar consultas de metadatos durante 40 ms, hasta 64 por llamada. El servidor obtiene cada identidad de una sesión verificada; el lote ejecuta los controles de `app.activity_sync` para esa identidad. El cliente y el rol anónimo no pueden llamar a la función interna. No se almacenan resultados ni permisos en una caché. El [contraste remoto](sincronizacion-lotes-remota.json) verificó identidad, revisión y rechazo de llamadas directas; [GitHub Actions](ci-sincronizacion-lotes-20261003.json) aprobó los controles de esta revisión.

El [ensayo sostenido](capacidad-200-20261003.md) utilizó esas 29 migraciones y el build local `Z5uxLL2cTnt9wGYFb9jaw`. El calentamiento individual conservó 2.000 respuestas, con p95 de 426,99 ms y cero fallos. En los quince minutos individuales, el p95 aumentó a 42.365,05 ms, incluidos los reintentos tras errores temporales. Las 2.000 respuestas confirmadas se conservaron y los 200 estudiantes leyeron su nota publicada; hubo 339 fallos entre 170.547 solicitudes, un 0,199 %.

En el calentamiento guiado, la confirmación p95 fue 3.615,72 ms y la propagación 8.996,40 ms. Se enviaron y conservaron 1.818 respuestas; otras 182 no llegaron a enviarse dentro de la ventana del ejecutor. La fase guiada siguiente se interrumpió a los 202,93 segundos por el límite preventivo de transferencia adicional estimada de 1 GB. Ninguna respuesta confirmada apareció perdida o duplicada en la auditoría, pero no se completó esa medición ni se satisficieron sus latencias.

Las consultas ligeras individuales tuvieron p95 de 424,04 ms. Las descargas de estado alcanzaron p95 de 7.914,39 ms y hubo tiempos agotados en comandos y lecturas. La [observación de esperas](esperas-capacidad-20261003.json) encontró consultas activas de hasta 7.104 ms; el muestreo no encontró bloqueadores de transacción, aunque observó esperas internas de búfer y WAL. No permite aislar una causa única ni presentar esos tiempos como consumo de CPU. La lectura agrupada mejora una parte del recorrido y no acredita, por sí sola, capacidad suficiente.

La [lectura de cuotas](cuotas-observadas-20261003.json) corresponde a un momento del ensayo. Supabase seguía en Free y el panel indicaba 1,148 de 5 GB de transferencia, con retraso de actualización. No se habilitó facturación ni se incrementó el presupuesto durante la ejecución. La siguiente comprobación debe aportar una corrección comprobable o una comparación del candidato actualizado en Vercel; no repetir el mismo ensayo largo sin un cambio que lo justifique.
