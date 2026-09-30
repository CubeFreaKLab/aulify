# Diagnóstico individual con veinte migraciones

La medición del 30 de septiembre de 2026 fue de **01:30:24,521 a 01:31:24,793 UTC**, con la compilación local `kWhdsczTz0VM4q1tEx6j6`, revisión `a385bd6` y Supabase Free remoto. La preparación renovó las sesiones necesarias de las 204 cuentas ficticias existentes, separadas 2,5 segundos y sin esperas por errores; no creó cuentas.

| Medición | Resultado |
|---|---:|
| Respuestas enviadas y confirmadas | 200/200 |
| Confirmaciones conservadas en base de datos | 200/200 |
| Pérdidas o cambios de la clave confirmada | 0 |
| Ventana de envío de las 200 respuestas | 1.891,25 ms |
| p95 de confirmación | 3.965,98 ms |
| Solicitudes válidas medidas | 9.263 |
| Fallos técnicos | 68 (0,734 %) |
| p95 de sincronización | 549,25 ms |
| p95 de proyección | 4.211,19 ms |
| Transferencia de cuerpos observada, incluida preparación | 16.122.651 bytes |
| Estimación conservadora adicional | 42.152.502 bytes |

Los 68 fallos fueron lecturas con HTTP 503, clasificadas como `transport_timeout`: 58 de sincronización y diez de proyección. Todas comenzaron en los primeros diez segundos de la medición. No hubo errores en los comandos de respuesta. Los tiempos individuales se conservan en el [registro completo](datos-protocolo-60s-20260930012139.json); no se descartan los primeros segundos del resultado.

El [agregado del servicio](datos-protocolo-migracion20-servicio.json) registra 8.650 sincronizaciones, 348 proyecciones y 201 comandos con estado 200 en la ventana consultada. Su campo bruto `response.origin_time` presenta p95 de 207, 954 y 540, respectivamente. La unidad no quedó confirmada en la referencia consultada y no se identifica cada solicitud: estos valores no se convierten en tiempos SQL ni se restan de los percentiles HTTP para atribuir una causa.

El ensayo confirma persistencia, pero **no aprueba Q-06**: el ACK excede 1.500 ms. Conserva el sondeo de un segundo y no cambia los umbrales. Es un diagnóstico de un minuto, individual, con una respuesta por estudiante; faltan calentamiento de cinco minutos, medición de quince, diez preguntas y modo guiado. Q-09 tampoco queda aprobado mediante esta estimación de consumo.

La siguiente instrumentación separará preparación, espera del RPC y codificación dentro del servidor. Así podrá localizarse la espera por solicitud sin confundir medias SQL, métricas del proveedor y percentiles del cliente.
