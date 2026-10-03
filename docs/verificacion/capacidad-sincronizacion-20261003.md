# Confirmación de respuestas y diagnóstico de capacidad

El ajuste de sincronización redujo el trabajo repetido después de confirmar una respuesta. El diagnóstico corto del 3 de octubre confirmó y conservó las 200 respuestas con un p95 de **1.236,09 ms**, dentro de los 1.500 ms previstos. No registró fallos técnicos. Este resultado permite iniciar la medición sostenida; por sí solo no aprueba Q-06, Q-09 ni AP-35.

## Qué se corrigió

La respuesta del servidor ya contiene el intento actualizado. Descargarlo de nuevo porque cambió su revisión añadía una lectura completa por estudiante. El cliente ahora puede aceptar esa revisión cuando conoce su base y el servidor confirma que el intento incluye todos los cambios individuales producidos por el envío. La comprobación conserva las lecturas si hubo un cambio común del docente, una base desconocida, un plazo o recuperación tras un fallo. Mientras envía una respuesta, ese cliente suspende su sondeo; los otros participantes continúan consultando.

Las migraciones 26 y 27 conservan puntuación, permisos e idempotencia. No cambian entidades ni aumentan las cuotas del plan. Diecisiete pruebas del almacén comprobaron confirmación, descarte de lecturas antiguas, cambios externos y recuperación. Ocho comprobaciones SQL aisladas verificaron revisiones, permisos y respuestas; un cambio común dentro de la transacción se simuló con un disparador de prueba. Esa simulación no equivale a concurrencia entre conexiones. El [ensayo remoto de reintento](revision-ack-remota.json) contrastó la base y la revisión con PostgreSQL alojado, sin añadir otra respuesta.

## Mediciones conservadas

Las tres ejecuciones usaron la aplicación compilada local y Supabase Free alojado, cuatro docentes y 200 estudiantes ficticios, con sondeo cada segundo. Mantienen la ráfaga de 200 envíos en menos de dos segundos y los mismos umbrales.

| Diagnóstico | Confirmación p95 | Fallos técnicos | Respuestas confirmadas y persistidas | Interpretación |
| --- | ---: | ---: | ---: | --- |
| [Antes del ajuste](datos-protocolo-60s-20261003140509.json) | 3.314,42 ms | 0 | 200 | Supera el límite de confirmación. |
| [Primera revisión](datos-protocolo-60s-20261003143132.json) | 8.405,38 ms | 200 | 200 | Empeoró; se conservaron los fallos y se corrigió la omisión de lecturas externas. |
| [Con base y proyección comprobadas](datos-protocolo-60s-20261003151449.json) | 1.236,09 ms | 0 | 200 | Cumple el límite en este diagnóstico corto. |

La última ejecución utilizó el build local `Q8X9tTMoeF3--ijLW3OwY`, con el cambio de aplicación `2fb31d2` y las 27 migraciones remotas. La preparación y la auditoría quedan fuera de los sesenta segundos. La ráfaga se distribuyó en 1.862,91 ms. Las 11.053 consultas ligeras y las 209 descargas de proyección no fallaron; su p95 fue 904,79 ms y 3.334,56 ms, respectivamente. El tiempo de RPC incluye transporte y servicio; no se presenta como tiempo SQL puro.

El ejecutor simula el protocolo HTTP y la aplicación conserva sus controles de autorización. No ejecuta 204 navegadores, no mide dibujo de pantalla y no acredita el rendimiento de Vercel. La publicación, el correo y la comprobación conjunta de cuotas mantienen su evidencia separada. La prueba completa requiere cinco minutos de calentamiento y quince de medición en cada modo, con diez preguntas, auditoría de integridad y lectura de notas publicadas.
